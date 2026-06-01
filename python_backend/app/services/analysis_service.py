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
from app.services.calendar_service import BaziResult, calculate_bazi
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

    # ---- 2. RAG 知识检索 ----
    # 从八字结果提取关键词 → 检索古籍知识库 → 构建引用上下文
    kb_context = _build_kb_context(bazi_result)

    # ---- 3. AI 分析管线 ----
    # API key 配置时注入真实 Claude executor，否则走 mock
    executor = create_claude_executor() if settings.ANTHROPIC_API_KEY else None
    pipeline = create_oasis_analyze_workflow(executor=executor)
    workflow_result = pipeline.run(
        input_data={
            "birth_date": user_input.birth_date,
            "birth_time": user_input.birth_time,
            "gender": user_input.gender,
            "location": user_input.location,
            "is_solar_time": user_input.is_solar_time,
            "bazi_full": bazi_result.full_bazi,
            "kb_context": kb_context,
        }
    )

    # ---- 3. 提取 AI 分析文本 ----
    analysis_text = _extract_analysis_text(workflow_result)

    # ---- 4. 持久化 Report ----
    report = Report(
        user_id=user_id,
        birth_info=_format_birth_info(user_input),
        calendar_data=bazi_result.to_dict(),
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
        "calendar_data": bazi_result.to_dict(),
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
        "kb_references": _extract_kb_references(kb_context),
    }


# ---------------------------------------------------------------------------
# 内部工具函数
# ---------------------------------------------------------------------------


def _format_birth_info(user_input: UserInput) -> str:
    """将 UserInput 格式化为 Report.birth_info 字符串（≤100 chars）。"""
    parts = [
        user_input.birth_date,
        user_input.birth_time,
    ]
    if user_input.gender:
        parts.append(user_input.gender)
    if user_input.location:
        parts.append(user_input.location)
    return " ".join(parts)


def _extract_analysis_text(workflow_result) -> str:
    """从 workflow 最终输出中提取 AI 分析纯文本。"""
    if workflow_result.final_output is None:
        return ""
    if isinstance(workflow_result.final_output, str):
        return workflow_result.final_output
    if isinstance(workflow_result.final_output, dict):
        return workflow_result.final_output.get("analysis", "")
    return str(workflow_result.final_output)


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

    model_name = str(output.get("model", "unknown"))[:50]

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


def _build_kb_context(bazi_result) -> str:
    """
    查询 RAG 知识库并构建古籍引用上下文。

    从八字结果提取关键词 → 逐词检索知识库 → 去重合并 → 格式化为
    可注入 AI prompt 的上下文文本。

    Returns:
        格式化的古籍引用文本，形如：
        【古籍引用】
        1. 《文献名》 > "原文段落..." (相关度: 0.85)
        2. ...
        若知识库为空或未初始化，返回空字符串。
    """
    try:
        from app.core.kb_provider import get_kb  # noqa: F811

        kb = get_kb()
    except RuntimeError:
        logger.warning("KnowledgeBase not initialized, skipping RAG retrieval")
        return ""

    if kb.document_count == 0:
        logger.info("KnowledgeBase is empty, skipping RAG retrieval")
        return ""

    search_terms = _extract_kb_search_terms(bazi_result)
    if not search_terms:
        return ""

    # 逐词检索，去重合并（按 document_id 去重，保留最高分）
    seen_ids: set[str] = set()
    merged: list[tuple[str, str, float]] = []  # (title, snippet, score)

    for term in search_terms:
        results = kb.search(term, top_k=2)
        for r in results:
            if r.document_id not in seen_ids:
                seen_ids.add(r.document_id)
                merged.append((r.title, r.content_snippet, r.score))

    if not merged:
        logger.info("No KB results for terms: %s", search_terms)
        return ""

    # 按分数降序，取 top 5
    merged.sort(key=lambda x: x[2], reverse=True)
    merged = merged[:5]

    # 构建引用文本
    lines = ["【古籍引用：以下内容源自传统命理典籍，供分析参考】", ""]
    for i, (title, snippet, score) in enumerate(merged, 1):
        # 截断过长段落
        display_snippet = snippet[:200] if len(snippet) > 200 else snippet
        lines.append(f"{i}. 《{title}》 (相关度: {score:.2f})")
        lines.append(f"   \"{display_snippet}\"")
        lines.append("")

    context = "\n".join(lines)
    logger.info(
        "KB context built: %d references, %d chars",
        len(merged),
        len(context),
    )
    return context


def _extract_kb_references(kb_context: str) -> list[dict]:
    """
    从 kb_context 文本中提取引用信息列表，用于 API 响应。

    Returns:
        [{"title": "渊海子平", "snippet": "...", "score": 0.92}, ...]
    """
    import re

    refs: list[dict] = []
    # 解析形如 "1. 《书名》 (相关度: 0.85)" 的行
    pattern = re.compile(
        r'^\d+\.\s*《(.+?)》\s*\(相关度:\s*([\d.]+)\)',
        re.MULTILINE,
    )
    matches = pattern.findall(kb_context)
    for title, score in matches:
        refs.append({
            "title": title,
            "score": float(score),
        })
    return refs
