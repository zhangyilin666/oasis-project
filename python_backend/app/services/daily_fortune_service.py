# -*- coding: utf-8 -*-
"""
每日运势生成服务。

从用户的八字报告中提取命盘，结合今日天象（流日/流月/流年），
通过 DeepSeek AI 生成个性化每日运势解读。

流程：
  1. 查缓存 → 命中则直接返回
  2. 加载用户最新 Report → 重建八字/大运数据
  3. 计算今日流日十神、冲合
  4. 构建 prompt → 单次 AI 调用 → 解析 JSON 输出
  5. 写入 DailyFortune → 返回

用法::

    from app.services.daily_fortune_service import get_daily_fortune

    result = get_daily_fortune(user_id=current_user.id, db=db)
"""
from __future__ import annotations

import json
import re
from datetime import date, datetime
from typing import Optional

from openai import OpenAI
from sqlalchemy import select, func
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.logger import logger
from app.models.daily_fortune_model import DailyFortune
from app.models.report_model import Report
from app.models.report_status import ReportStatus
from app.models.user_model import User
from app.services.calendar_service import (
    BaziResult,
    DailyFortuneData,
    DayunInfo,
    PillarInfo,
    YunResult,
    calculate_daily_fortune_data,
)


# ── 模块级 AI 客户端单例（避免每次调用创建新连接池）────────
_deepseek_client = None
_anthropic_client = None


def _get_deepseek_client() -> OpenAI:
    """获取 DeepSeek OpenAI 兼容客户端单例。"""
    global _deepseek_client
    if _deepseek_client is None:
        _deepseek_client = OpenAI(
            api_key=settings.DEEPSEEK_API_KEY,
            base_url=settings.DEEPSEEK_BASE_URL,
            max_retries=0,
        )
    return _deepseek_client


def _get_anthropic_client():
    """获取 Anthropic 客户端单例。"""
    global _anthropic_client
    if _anthropic_client is None:
        import anthropic as anthropic_sdk
        kwargs = {"api_key": settings.ANTHROPIC_API_KEY, "max_retries": 0}
        if settings.ANTHROPIC_BASE_URL:
            kwargs["base_url"] = settings.ANTHROPIC_BASE_URL
        _anthropic_client = anthropic_sdk.Anthropic(**kwargs)
    return _anthropic_client


# ── AI Prompt 模板 ────────────────────────────────────────────────────

DAILY_FORTUNE_PROMPT = """你是一位善解人意的命理老师。请根据用户的八字命盘和今天的天象，生成一段简短温暖的今日运势解读。

{fortune_context}

【写作要求】
1. 用生活化的大白话，像朋友聊天一样，不要用专业术语堆砌
2. 先解释今天对你的意义（基于十神关系和冲合），再用2-3句话给出今日建议
3. 幸运色和幸运方位要结合五行生克来选取
4. 如果有冲克，语气要温暖提醒，不要恐吓
5. 最后输出严格的 JSON 格式（不要输出任何其他内容）：

{{{{
  "fortune_text": "运势解读正文（3-5句话，200字以内，纯文本）",
  "lucky_color": "幸运颜色（1个，如 天蓝色）",
  "lucky_direction": "幸运方位（1个，如 北方）",
  "warning": "注意事项（1句话，无则填'无'）"
}}}}"""


# ── 公开接口 ──────────────────────────────────────────────────────────


def get_daily_fortune(
    user_id: int,
    db: Session,
    today: Optional[date] = None,
    report_id: Optional[int] = None,
) -> dict:
    """
    获取今日运势（带缓存）。

    Args:
        user_id: 用户 ID。
        db: SQLAlchemy Session。
        today: 运势日期，默认今天。

    Returns:
        dict with keys:
            - date: 运势日期
            - day_gan_zhi: 今日干支
            - day_relation: 十神关系
            - clash_info: 冲合信息
            - fortune_text: AI 运势解读
            - lucky_color: 幸运色
            - lucky_direction: 幸运方位
            - warning: 注意事项
            - is_cached: 是否来自缓存

    Raises:
        ValueError: 用户没有八字报告。
        RuntimeError: AI 调用失败。
    """
    if today is None:
        from datetime import timezone, timedelta
        today = datetime.now(timezone(timedelta(hours=8))).date()

    # 同一用户串行生成，防止并发打开首页时重复付费或撞唯一键。
    db.execute(select(User.id).where(User.id == user_id).with_for_update()).first()
    stmt = select(Report).where(
        Report.user_id == user_id, Report.status == ReportStatus.COMPLETED, Report.deleted_at.is_(None),
    )
    if report_id is not None:
        stmt = stmt.where(Report.id == report_id)
    report = db.scalar(stmt.order_by(Report.created_at.desc(), Report.id.desc()).limit(1).with_for_update())
    if report is None or not report.calendar_data:
        raise ValueError("请先选择一份已完成的八字报告")

    # ── 1. 查缓存 ──
    cached = db.scalar(
        select(DailyFortune).where(
            DailyFortune.user_id == user_id,
            DailyFortune.fortune_date == today,
        ).with_for_update()
    )
    if cached and cached.report_id == report.id:
        logger.info("Daily fortune cache hit: user_id=%s date=%s", user_id, today)
        db.commit()
        return {**_fortune_to_response(cached, is_cached=True), "report_id": report.id, "birth_info": report.birth_info}

    # ── 3. 重建八字/大运数据 ──
    calendar_data = report.calendar_data or {}
    bazi_result = _rebuild_bazi_from_dict(calendar_data)
    yun_result = _rebuild_yun_from_dict(calendar_data.get("yun"))

    # ── 4. 计算今日运势原始数据 ──
    today_str = today.isoformat()
    fortune_data = calculate_daily_fortune_data(
        bazi_result=bazi_result,
        yun_result=yun_result,
        today_date=today_str,
    )

    # ── 5. 调用 AI ──
    ai_response = _call_ai(fortune_data)

    # ── 6. 持久化 ──
    daily_fortune = DailyFortune(
        user_id=user_id,
        report_id=report.id,
        fortune_date=today,
        day_gan_zhi=fortune_data.day_gan_zhi,
        day_relation=fortune_data.day_relation,
        clash_info=fortune_data.clash_info if fortune_data.clash_info != "无冲合" else None,
        fortune_text=ai_response.get("fortune_text", ""),
        lucky_color=ai_response.get("lucky_color"),
        lucky_direction=ai_response.get("lucky_direction"),
        warning=ai_response.get("warning"),
    )
    if cached:
        for key in ("report_id", "day_gan_zhi", "day_relation", "clash_info", "fortune_text", "lucky_color", "lucky_direction", "warning"):
            setattr(cached, key, getattr(daily_fortune, key))
        daily_fortune = cached
    else:
        db.add(daily_fortune)
    db.commit()
    db.refresh(daily_fortune)

    logger.info(
        "Daily fortune generated: user_id=%s date=%s day_gan_zhi=%s",
        user_id,
        today,
        fortune_data.day_gan_zhi,
    )

    return {**_fortune_to_response(daily_fortune, is_cached=False), "report_id": report.id, "birth_info": report.birth_info}


# ── 内部辅助函数 ──────────────────────────────────────────────────────


def _fortune_to_response(fortune: DailyFortune, is_cached: bool) -> dict:
    """将 ORM 对象转为 API 响应字典。"""
    return {
        "date": fortune.fortune_date.isoformat() if fortune.fortune_date else "",
        "day_gan_zhi": fortune.day_gan_zhi,
        "day_relation": fortune.day_relation,
        "clash_info": fortune.clash_info or "",
        "fortune_text": fortune.fortune_text,
        "lucky_color": fortune.lucky_color or "",
        "lucky_direction": fortune.lucky_direction or "",
        "warning": fortune.warning or "",
        "is_cached": is_cached,
    }


def _rebuild_bazi_from_dict(data: dict) -> BaziResult:
    """从 calendar_data JSON 重建 BaziResult 对象。"""

    def _build_pillar(key: str) -> PillarInfo:
        pillar = data.get(key, {}) if isinstance(data, dict) else {}
        return PillarInfo(
            gan_zhi=pillar.get("gan_zhi", ""),
            gan=pillar.get("gan", ""),
            zhi=pillar.get("zhi", ""),
            na_yin=pillar.get("na_yin", ""),
            wu_xing=pillar.get("wu_xing", ""),
            shi_shen_gan=pillar.get("shi_shen_gan", ""),
            shi_shen_zhi=pillar.get("shi_shen_zhi", ""),
            di_shi=pillar.get("di_shi", ""),
            hide_gan=pillar.get("hide_gan", ""),
            xun=pillar.get("xun", ""),
            xun_kong=pillar.get("xun_kong", ""),
        )

    return BaziResult(
        year=_build_pillar("year"),
        month=_build_pillar("month"),
        day=_build_pillar("day"),
        hour=_build_pillar("hour"),
    )


def _rebuild_yun_from_dict(yun_data: Optional[dict]) -> YunResult:
    """从 calendar_data.yun JSON 重建 YunResult 对象。"""
    if not yun_data or not isinstance(yun_data, dict):
        return YunResult()

    da_yun_list = []
    for dy_dict in yun_data.get("da_yun", []) or []:
        da_yun_list.append(DayunInfo(
            index=dy_dict.get("index", 0),
            gan_zhi=dy_dict.get("gan_zhi", ""),
            start_age=dy_dict.get("start_age", 0),
            end_age=dy_dict.get("end_age", 0),
            start_year=dy_dict.get("start_year", 0),
            end_year=dy_dict.get("end_year", 0),
            xun=dy_dict.get("xun", ""),
            xun_kong=dy_dict.get("xun_kong", ""),
        ))

    return YunResult(
        gender_int=yun_data.get("gender_int", 1),
        start_year_num=yun_data.get("start_year_num", 0),
        start_month_num=yun_data.get("start_month_num", 0),
        start_day_num=yun_data.get("start_day_num", 0),
        is_forward=yun_data.get("is_forward", True),
        start_solar_date=yun_data.get("start_solar_date", ""),
        da_yun=da_yun_list,
    )


# ── AI 调用 ───────────────────────────────────────────────────────────


def _call_ai(fortune_data: DailyFortuneData) -> dict:
    """
    调用 AI 生成每日运势。

    根据 AI_PROVIDER 配置选择后端：
      - deepseek → OpenAI 兼容协议
      - anthropic → Anthropic Messages API（原生 SDK）
      - 未配置 → mock 数据
    """
    provider = settings.AI_PROVIDER.lower().strip()

    if provider == "deepseek" and settings.DEEPSEEK_API_KEY:
        return _call_deepseek_api(fortune_data)
    elif provider == "anthropic" and settings.ANTHROPIC_API_KEY:
        return _call_anthropic_api(fortune_data)
    else:
        if not settings.ALLOW_MOCK_AI:
            raise RuntimeError("AI 服务尚未配置，请联系管理员")
        logger.warning("No AI provider configured, returning mock daily fortune")
        return _mock_daily_fortune(fortune_data)


def _build_daily_fortune_prompt(fortune_data: DailyFortuneData) -> str:
    """构建每日运势 prompt（处理花括号转义）。"""
    prompt = DAILY_FORTUNE_PROMPT.replace(
        "{fortune_context}", fortune_data.to_prompt_context()
    )
    # DAILY_FORTUNE_PROMPT 里的 {{{{ }}}} 是字面量花括号的转义，
    # 还原为 JSON 示例所需的单个花括号。
    prompt = prompt.replace("{{{{", "{").replace("}}}}", "}")
    return prompt


def _call_deepseek_api(fortune_data: DailyFortuneData) -> dict:
    """通过 DeepSeek OpenAI 兼容 API 生成每日运势。"""
    client = _get_deepseek_client()
    model = settings.DEEPSEEK_DEFAULT_MODEL
    prompt = _build_daily_fortune_prompt(fortune_data)

    logger.info(
        "Calling DeepSeek for daily fortune: day=%s relation=%s clash=%s prompt_len=%d",
        fortune_data.day_gan_zhi,
        fortune_data.day_relation,
        fortune_data.clash_info,
        len(prompt),
    )

    try:
        response = client.chat.completions.create(
            model=model,
            max_tokens=1024,
            temperature=0.85,
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
            **({"extra_body": {"thinking": {"type": "disabled"}}}
               if model in ("deepseek-flash", "deepseek-v4-pro") else {}),
            timeout=60.0,
        )
    except Exception as exc:
        logger.error("Daily fortune DeepSeek call failed: %s", exc)
        raise RuntimeError("每日运势生成失败: {}".format(exc)) from exc

    text = _extract_text(response)

    usage = {}
    if response.usage:
        usage = {
            "input_tokens": response.usage.prompt_tokens,
            "output_tokens": response.usage.completion_tokens,
        }
    logger.info(
        "Daily fortune AI: tokens_in=%d tokens_out=%d",
        usage.get("input_tokens", 0),
        usage.get("output_tokens", 0),
    )

    if not text or (response.choices and response.choices[0].finish_reason == "length"):
        raise RuntimeError("AI 返回了空内容")

    return _parse_ai_response(text)


def _call_anthropic_api(fortune_data: DailyFortuneData) -> dict:
    """通过 Anthropic Messages API（原生 SDK）生成每日运势。"""
    client = _get_anthropic_client()
    model = settings.ANTHROPIC_DEFAULT_MODEL
    prompt = _build_daily_fortune_prompt(fortune_data)

    logger.info(
        "Calling Anthropic for daily fortune: day=%s relation=%s clash=%s prompt_len=%d model=%s",
        fortune_data.day_gan_zhi,
        fortune_data.day_relation,
        fortune_data.clash_info,
        len(prompt),
        model,
    )

    try:
        message = client.messages.create(
            model=model,
            max_tokens=1024,
            temperature=0.85,
            messages=[{"role": "user", "content": prompt}],
            timeout=60.0,
        )
    except Exception as exc:
        logger.error("Daily fortune Anthropic call failed: %s", exc)
        raise RuntimeError("每日运势生成失败: {}".format(exc)) from exc

    text = ""
    if message.content:
        for block in message.content:
            if hasattr(block, "text"):
                text += block.text

    usage = {}
    if hasattr(message, "usage") and message.usage:
        usage = {
            "input_tokens": getattr(message.usage, "input_tokens", 0),
            "output_tokens": getattr(message.usage, "output_tokens", 0),
        }
    logger.info(
        "Daily fortune Anthropic: tokens_in=%d tokens_out=%d",
        usage.get("input_tokens", 0),
        usage.get("output_tokens", 0),
    )

    if not text or getattr(message, "stop_reason", None) == "max_tokens":
        raise RuntimeError("AI 返回了空内容")

    return _parse_ai_response(text)


def _extract_text(response) -> str:
    """从 Chat Completions 响应中提取纯文本。"""
    if response.choices and len(response.choices) > 0:
        choice = response.choices[0]
        if choice.message and choice.message.content:
            return choice.message.content
    return ""


def _parse_ai_response(text: str) -> dict:
    """接收 JSON 对象，拒绝空正文与非法字段，避免坏结果写入每日缓存。"""
    candidates = [text.strip()]
    json_match = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
    if json_match:
        candidates.append(json_match.group(1).strip())
    brace_match = re.search(r"\{[\s\S]*\}", text)
    if brace_match:
        candidates.append(brace_match.group(0))
    for candidate in candidates:
        try:
            data = json.loads(candidate)
        except json.JSONDecodeError:
            continue
        if not isinstance(data, dict):
            continue
        result = {}
        for key, limit in (("fortune_text", 2000), ("lucky_color", 20), ("lucky_direction", 20), ("warning", 200)):
            value = data.get(key, "")
            if not isinstance(value, str) or len(value) > limit:
                raise RuntimeError("AI 返回字段格式不正确，请重试")
            result[key] = value.strip()
        if not result["fortune_text"]:
            raise RuntimeError("AI 返回正文为空，请重试")
        return result
    raise RuntimeError("AI 返回内容不是有效的 JSON 对象，请重试")


def _mock_daily_fortune(fortune_data: DailyFortuneData) -> dict:
    """当 AI 不可用时返回的 mock 数据。"""
    relation = fortune_data.day_relation or "比肩"
    clash = fortune_data.clash_info if fortune_data.clash_info != "无冲合" else ""
    day_gz = fortune_data.day_gan_zhi

    mock_text = f"【演示内容】今天{day_gz}日，是您的{relation}日。"

    if "冲" in clash:
        mock_text += f" 今天是{clash.split('·')[0]}，建议保持低调，避免冲突。"
    elif "合" in clash:
        mock_text += f" 今天是{clash.split('·')[0]}，诸事顺遂，适合社交合作。"
    else:
        mock_text += " 运势平稳，按照自己的节奏推进就好。"

    mock_text += " 保持平常心，今天的努力会在未来开花结果。"

    return {
        "fortune_text": mock_text,
        "lucky_color": "天蓝色",
        "lucky_direction": "东方",
        "warning": "无",
    }
