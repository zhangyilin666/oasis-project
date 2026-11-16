# -*- coding: utf-8 -*-
"""
分析业务编排服务。

封装完整的八字分析闭环：
  用户输入 → 八字排盘 → AI 分析管线 → Report 持久化 → AnalysisLog 审计

架构位置：
  Router → Depends(Auth) → analysis_service.analyze_user_input() → ORM → DB

用法::

    from app.services.analysis_service import analyze_user_input

    result = analyze_user_input(
        user_id=current_user.id,
        user_input=user_input,
        db=db,
    )
"""
from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.logger import logger
from app.models.log_model import AnalysisLog
from app.models.report_model import Report
from app.schemas.oasis_schema import UserInput
from app.services.ai_client import create_claude_executor
from app.services.report_integrity import report_facts, verified_executor, verification_summary
from app.services.calendar_service import (
    BaziResult,
    YunResult,
    calculate_bazi,
    calculate_dayun,
    format_bazi_data_text,
    format_yun_data_text,
)
from app.services.deepseek_client import create_deepseek_executor
from app.services.workflow_service import (
    StepResult,
    create_oasis_analyze_workflow,
)


def analyze_user_input(
    user_id: int,
    user_input: UserInput,
    db: Session,
) -> dict:
    """
    执行完整八字分析流程并持久化结果。

    流程：
    1. lunar-python 八字排盘
    2. RAG 知识库检索古籍引用
    3. AI 分析管线（Claude API 或 mock，取决于 ANTHROPIC_API_KEY 是否配置）
    4. 写入 Report（八字数据 + AI 分析文本）
    5. 写入 AnalysisLog（每步耗时、模型、Token 用量）
    6. 提交事务并返回完整结果

    Args:
        user_id: 已登录用户 ID。
        user_input: 用户提交的出生信息。
        db: SQLAlchemy Session（由 FastAPI Depends(get_db) 注入）。

    Returns:
        dict with keys:
            - user_id
            - report_id
            - calendar_data
            - ai_analysis_text
            - workflow_status
            - workflow_steps
            - trace_id
            - kb_references (古籍引用来源)

    Raises:
        ValueError: 八字排盘输入无效。
    """
    trace_id = uuid.uuid4().hex[:16]
    logger.info(
        "Analysis started: user_id=%s trace_id=%s birth_date=%s",
        user_id,
        trace_id,
        user_input.birth_date,
    )

    # ---- 1. 八字排盘 ----
    bazi_result = calculate_bazi(
        birth_date=user_input.birth_date,
        birth_time=user_input.birth_time,
        is_solar_time=user_input.is_solar_time,
    )

    # ---- 1.5 大运/流年排盘 ----
    yun_result = calculate_dayun(
        birth_date=user_input.birth_date,
        birth_time=user_input.birth_time,
        gender=user_input.gender,
        is_solar_time=user_input.is_solar_time,
    )
    yun_data_text = format_yun_data_text(yun_result)

    # ---- 1.6 格式化八字排盘文本（供 AI prompt 使用） ----
    bazi_data_text = format_bazi_data_text(bazi_result)

    # ---- 2. RAG 知识检索 ----
    # 从八字结果提取关键词 → 检索古籍知识库 → 构建引用上下文
    kb_context, kb_references = _build_kb_evidence(bazi_result)

    # ---- 3. AI 分析管线 ----
    # 按 AI_PROVIDER 配置选择 executor 和模型名
    executor, ai_model = _resolve_ai_backend()
    executor = verified_executor(executor, report_facts(bazi_result, yun_result), kb_references)
    pipeline = create_oasis_analyze_workflow(executor=executor, ai_model=ai_model)
    workflow_result = pipeline.run(
        input_data={
            "birth_date": user_input.birth_date,
            "birth_time": user_input.birth_time,
            "gender": user_input.gender,
            "location": user_input.location,
            "is_solar_time": user_input.is_solar_time,
            "bazi_full": bazi_result.full_bazi,
            "bazi_data_text": bazi_data_text,
            "kb_context": kb_context,
            "yun_data_text": yun_data_text,
        }
    )

    # ---- 3. 提取 AI 分析文本 ----
    analysis_text = _extract_analysis_text(workflow_result)

    # ---- 3.5 提取大运白话总结 ----
    yun_summary_text = _extract_step_output(workflow_result, "dayun_summary")

    if workflow_result.status != "success" or not analysis_text.strip() or not yun_summary_text.strip():
        raise RuntimeError("AI 分析未通过完整性校验，请稍后重试")

    # ---- 4. 持久化 Report ----
    calendar_data = bazi_result.to_dict()
    calendar_data["yun"] = yun_result.to_dict()
    calendar_data["yun_summary"] = yun_summary_text
    calendar_data["suggestion"] = _extract_step_output(workflow_result, "suggestion")
    calendar_data["references"] = kb_references
    calendar_data["verification"] = verification_summary(workflow_result)

    report = Report(
        user_id=user_id,
        birth_info=_format_birth_info(user_input),
        calendar_data=calendar_data,
        ai_analysis=analysis_text,
    )
    db.add(report)
    db.flush()  # 获取 report.id，同时触发 FK 约束校验

    # ---- 5. 持久化 AnalysisLog（每步一条审计记录） ----
    for step_result in workflow_result.steps:
        log_entry = _build_analysis_log(
            user_id=user_id,
            report_id=report.id,
            step_result=step_result,
            trace_id=trace_id,
        )
        db.add(log_entry)

    db.commit()
    logger.info(
        "Analysis committed: user_id=%s report_id=%s trace_id=%s steps=%d",
        user_id,
        report.id,
        trace_id,
        len(workflow_result.steps),
    )

    # ---- 6. 构建返回数据 ----
    return {
        "user_id": user_id,
        "report_id": report.id,
        "calendar_data": calendar_data,
        "ai_analysis_text": analysis_text,
        "workflow_status": workflow_result.status,
        "workflow_steps": [
            {
                "step": s.step_name,
                "status": s.status,
                "duration_ms": s.duration_ms,
            }
            for s in workflow_result.steps
        ],
        "trace_id": trace_id,
        "kb_references": kb_references,
    }


# ---------------------------------------------------------------------------
# 内部工具函数
# ---------------------------------------------------------------------------


def _resolve_ai_backend() -> tuple:
    """
    根据 AI_PROVIDER 配置解析 AI executor 和模型名。

    优先级：
      1. AI_PROVIDER=deepseek + DEEPSEEK_API_KEY → DeepSeek
      2. AI_PROVIDER=anthropic + ANTHROPIC_API_KEY → Claude
      3. 其他 → mock（无 API key 也走 mock）

    Returns:
        (StepExecutor | None, ai_model: str)
        executor=None 时走 mock 模式。
    """
    provider = settings.AI_PROVIDER.lower().strip()

    if provider == "deepseek" and settings.DEEPSEEK_API_KEY:
        logger.info("AI backend: DeepSeek (model=%s)", settings.DEEPSEEK_DEFAULT_MODEL)
        return create_deepseek_executor(), settings.DEEPSEEK_DEFAULT_MODEL

    if provider == "anthropic" and settings.ANTHROPIC_API_KEY:
        logger.info("AI backend: Anthropic Claude (model=%s)", settings.ANTHROPIC_DEFAULT_MODEL)
        return create_claude_executor(), settings.ANTHROPIC_DEFAULT_MODEL

    if not settings.ALLOW_MOCK_AI:
        raise RuntimeError("AI 服务尚未配置，请联系管理员")
    logger.warning(
        "AI backend: MOCK (provider=%s, deepseek_key=%s, anthropic_key=%s)",
        provider,
        "set" if settings.DEEPSEEK_API_KEY else "empty",
        "set" if settings.ANTHROPIC_API_KEY else "empty",
    )
    return None, "mock"


def _format_birth_info(user_input: UserInput) -> str:
    """将 UserInput 格式化为 Report.birth_info 字符串（≤100 chars）。"""
    parts = [
        user_input.name,
        user_input.birth_date,
        user_input.birth_time,
    ]
    if user_input.gender:
        parts.append(user_input.gender)
    if user_input.location:
        parts.append(user_input.location)
    return " ".join(parts)[:100]


def _extract_analysis_text(workflow_result) -> str:
    """从 workflow 结果中提取 AI 命理分析纯文本（Step 2: ai_analysis）。"""
    return _extract_step_output(workflow_result, "ai_analysis")


def _extract_step_output(workflow_result, step_name: str) -> str:
    """
    从 WorkflowResult 中提取指定步骤的 AI 分析文本。

    遍历所有步骤，找到 name 匹配的步骤，从其 output dict
    中提取 "analysis" 字段。未找到或失败时返回空字符串。

    Args:
        workflow_result: 工作流执行结果。
        step_name: 步骤名，如 "dayun_summary"。

    Returns:
        AI 生成的纯文本，或空字符串。
    """
    for step in workflow_result.steps:
        if step.step_name == step_name and step.status == "success":
            output = step.output
            if isinstance(output, dict):
                return output.get("analysis", "")
            if isinstance(output, str):
                return output
    return ""


# 底层 AI 提供商名称 → 面向用户的品牌名映射
# 目的：用户不需要知道后台用了 DeepSeek / Claude，避免“AI 算命”抵触心理
_MODEL_BRAND_MAP: dict[str, str] = {
    "deepseek-chat": "猫来运转 AI",
    "deepseek-reasoner": "猫来运转 AI",
    "claude-sonnet-4-6": "猫来运转 AI",
    "claude-opus-4-8": "猫来运转 AI",
    "mock": "猫来运转 AI",
    "unknown": "猫来运转 AI",
}
_DEFAULT_BRAND_NAME: str = "猫来运转 AI"


def _brand_model_name(raw_name: str) -> str:
    """将底层 AI 模型名映射为面向用户的品牌名。"""
    return _MODEL_BRAND_MAP.get(raw_name, _DEFAULT_BRAND_NAME)


def _build_analysis_log(
    user_id: int,
    report_id: int,
    step_result: StepResult,
    trace_id: str,
) -> AnalysisLog:
    """
    从 StepResult 构建 AnalysisLog ORM 对象。

    从 step_result.output (dict) 中提取 model、usage 等信息。
    mock 步骤无 token 用量，字段保留 NULL。
    """
    output: dict[str, Any] = (
        step_result.output if isinstance(step_result.output, dict) else {}
    )
    usage: dict[str, Any] = output.get("usage", {})
    if not isinstance(usage, dict):
        usage = {}

    input_tokens = usage.get("input_tokens")
    output_tokens = usage.get("output_tokens")

    # total_tokens = input + output（仅当两者都有值时计算，否则 NULL）
    if input_tokens is not None and output_tokens is not None:
        total_tokens = input_tokens + output_tokens
    else:
        total_tokens = None

    raw_model = str(output.get("model", "unknown"))[:50]
    # 面向用户的分析日志：隐藏底层 AI 提供商名称，展示产品品牌名
    model_name = _brand_model_name(raw_model)

    return AnalysisLog(
        user_id=user_id,
        report_id=report_id,
        model_name=model_name,
        status=step_result.status,
        prompt_tokens=input_tokens,
        completion_tokens=output_tokens,
        total_tokens=total_tokens,
        latency_ms=int(step_result.duration_ms),
        trace_id=trace_id,
    )


# ---------------------------------------------------------------------------
# RAG 知识检索辅助函数
# ---------------------------------------------------------------------------


def _extract_kb_search_terms(bazi_result) -> list[str]:
    """
    从八字排盘结果中提取知识库检索关键词。

    提取策略：
      - 日主天干 + 五行（如 "戊土"）
      - 日柱十神
      - 日柱地势（十二运）
      - 命宫、身宫
      - 命盘中出现的五行元素
      - 四柱中出现的十神（去重）

    Returns:
        去重后的检索词列表（最多 8 个），按相关性排序。
    """
    terms: list[str] = []

    # 1. 日主 + 五行（最重要）
    day_gan = bazi_result.day.gan
    day_wu_xing = bazi_result.day.wu_xing
    if day_gan:
        terms.append(f"{day_gan}日主")
        if day_wu_xing:
            terms.append(f"{day_gan}{day_wu_xing}")

    # 2. 日柱十神
    day_shi_shen = bazi_result.day.shi_shen_gan
    if day_shi_shen:
        for shen in day_shi_shen.split("、"):
            clean = shen.strip()
            if clean and clean != "日主":
                terms.append(clean)

    # 3. 日柱地势
    day_di_shi = bazi_result.day.di_shi
    if day_di_shi and day_di_shi not in ("", "—"):
        terms.append(day_di_shi)

    # 4. 五行元素
    wu_xing_summary = bazi_result.wu_xing_summary
    if wu_xing_summary:
        for wx, count in wu_xing_summary.items():
            if count > 0:
                terms.append(f"五行{wx}")

    # 5. 命宫、身宫
    if bazi_result.ming_gong:
        terms.append("命宫")
    if bazi_result.shen_gong:
        terms.append("身宫")

    # 6. 收集所有四柱十神（去重，补充）
    seen = set(terms)
    for pillar in [bazi_result.year, bazi_result.month, bazi_result.hour]:
        shi_shen = pillar.shi_shen_gan
        if shi_shen:
            for shen in shi_shen.split("、"):
                clean = shen.strip()
                if clean and clean not in seen and clean != "日主":
                    terms.append(clean)
                    seen.add(clean)
                    if len(terms) >= 8:
                        break
        if len(terms) >= 8:
            break

    logger.debug("KB search terms extracted: %s", terms[:8])
    return terms[:8]


def _build_kb_evidence(bazi_result) -> tuple[str, list[dict]]:
    """Persist the same bounded source excerpts supplied to the model."""
    from app.core.kb_provider import get_kb
    try:
        kb = get_kb()
    except RuntimeError:
        return "", []
    merged = {}
    for term in _extract_kb_search_terms(bazi_result):
        for result in kb.search(term, top_k=2):
            identity = (result.document_id, result.metadata.get("paragraph", 1))
            if identity not in merged or result.score > merged[identity].score:
                merged[identity] = result
    references = []
    for result in sorted(merged.values(), key=lambda item: item.score, reverse=True)[:5]:
        meta = result.metadata
        references.append({
            "id": f"{result.document_id}:p{meta.get('paragraph', 1)}:{meta.get('sha256', '')[:12]}",
            "document_id": result.document_id,
            "title": meta.get("display_title", result.title),
            "paragraph": meta.get("paragraph", 1),
            "kind": meta.get("content_kind", "项目学习笔记，来源待核验"),
            "sha256": meta.get("sha256", ""),
            "snippet": result.content_snippet[:200],
        })
    context = "\n\n".join(
        f"资料ID：{ref['id']}\n标题：{ref['title']} · 第{ref['paragraph']}段\n"
        f"性质：{ref['kind']}\n摘录：{ref['snippet']}" for ref in references
    )
    return context, references


def _build_kb_context(bazi_result) -> str:
    return _build_kb_evidence(bazi_result)[0]
