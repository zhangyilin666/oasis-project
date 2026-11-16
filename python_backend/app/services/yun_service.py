# -*- coding: utf-8 -*-
"""
大运流年服务。

从用户已完成八字报告中提取大运/流年数据，计算流年十神、冲合关系，
按会员等级裁剪返回数据。

用法::

    from app.services.yun_service import get_yun_fortune

    data = get_yun_fortune(db=db, user_id=current_user.id, is_premium=True)
"""
from __future__ import annotations

from datetime import date
from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.logger import logger
from app.models.report_model import Report
from app.models.report_status import ReportStatus
from app.services.calendar_service import (
    _calculate_shishen,
    _calculate_chong_he,
)
from app.services.daily_fortune_service import (
    _rebuild_bazi_from_dict,
    _rebuild_yun_from_dict,
)


def get_yun_fortune(
    db: Session,
    user_id: int,
    is_premium: bool,
) -> Optional[dict]:
    """
    获取用户的大运流年数据（含流年十神/冲合计算）。

    Args:
        db: SQLAlchemy Session。
        user_id: 用户 ID。
        is_premium: 是否为高级会员（True → 返回全部，False → 仅当前年）。

    Returns:
        dict with keys:
            - is_premium: 会员状态
            - start_info: 起运信息
            - current_da_yun_index: 当前大运序号
            - current_year: 当前年份
            - da_yun: 大运列表（含 enriched 流年）
        若用户无已完成报告，返回 None。
    """
    # ── 1. 查询最新已完成 Report ──
    report = db.scalar(
        select(Report)
        .where(
            Report.user_id == user_id,
            Report.status == ReportStatus.COMPLETED,
            Report.deleted_at.is_(None),
        )
        .order_by(Report.created_at.desc())
        .limit(1)
    )
    if not report:
        logger.info("No completed report for user_id=%s", user_id)
        return None

    calendar_data = report.calendar_data or {}
    yun_data = calendar_data.get("yun")
    if not yun_data or not isinstance(yun_data, dict):
        logger.info("No yun data in report for user_id=%s", user_id)
        return None

    da_yun_list_raw = yun_data.get("da_yun", [])
    if not da_yun_list_raw:
        return None

    # ── 2. 重建八字/大运数据对象 ──
    bazi_result = _rebuild_bazi_from_dict(calendar_data)
    yun_result = _rebuild_yun_from_dict(yun_data)

    day_master_gan = bazi_result.day.gan  # 日主天干
    day_zhi = bazi_result.day.zhi          # 日支
    year_zhi = bazi_result.year.zhi        # 年支（用于本命年判断）

    # ── 3. 当前年份信息 ──
    current_year = date.today().year
    current_da_yun_index = 0

    # ── 4. 计算起运年龄文本 ──
    start_age_parts = []
    if yun_result.start_year_num:
        start_age_parts.append(f"{yun_result.start_year_num}岁")
    if yun_result.start_month_num:
        start_age_parts.append(f"{yun_result.start_month_num}个月")
    if yun_result.start_day_num:
        start_age_parts.append(f"{yun_result.start_day_num}天")
    start_age_text = "".join(start_age_parts) if start_age_parts else "未知"

    # ── 5. 遍历大运流年，计算十神/冲合 ──
    enriched_da_yun = []

    for dy_dict in da_yun_list_raw:
        dy_index = dy_dict.get("index", 0)
        dy_start_year = dy_dict.get("start_year", 0)
        dy_end_year = dy_dict.get("end_year", 0)
        dy_is_current = dy_start_year <= current_year <= dy_end_year

        if dy_is_current:
            current_da_yun_index = dy_index

        # 遍历流年
        enriched_liu_nian = []
        for ln_dict in dy_dict.get("liu_nian", []) or []:
            ln_year = ln_dict.get("year", 0)
            ln_gan_zhi = ln_dict.get("gan_zhi", "")

            # 提取流年天干、地支
            ln_gan = ln_gan_zhi[0] if len(ln_gan_zhi) >= 1 else ""
            ln_zhi = ln_gan_zhi[1] if len(ln_gan_zhi) >= 2 else ""

            # 计算十神（流年天干 vs 日主天干）
            shi_shen = _calculate_shishen(day_master_gan, ln_gan) if day_master_gan and ln_gan else ""

            # 计算冲合（流年地支 vs 日支）
            chong_he = _calculate_chong_he(day_zhi, ln_zhi) if day_zhi and ln_zhi else ""

            # 本命年（流年地支 == 出生年地支）
            is_tai_sui = (ln_zhi == year_zhi) if ln_zhi and year_zhi else False

            # 是否当前年
            is_current = ln_year == current_year

            enriched_liu_nian.append({
                "year": ln_year,
                "age": ln_dict.get("age", 0),
                "gan_zhi": ln_gan_zhi,
                "xun": ln_dict.get("xun", ""),
                "xun_kong": ln_dict.get("xun_kong", ""),
                "shi_shen": shi_shen,
                "chong_he": chong_he,
                "is_tai_sui": is_tai_sui,
                "is_current": is_current,
            })

        enriched_da_yun.append({
            "index": dy_index,
            "gan_zhi": dy_dict.get("gan_zhi", ""),
            "start_age": dy_dict.get("start_age", 0),
            "end_age": dy_dict.get("end_age", 0),
            "start_year": dy_start_year,
            "end_year": dy_end_year,
            "xun": dy_dict.get("xun", ""),
            "xun_kong": dy_dict.get("xun_kong", ""),
            "is_current": dy_is_current,
            "liu_nian": enriched_liu_nian,
        })

    # ── 6. 免费用户裁剪：仅保留当前年 ──
    if not is_premium:
        enriched_da_yun = _filter_free_user(enriched_da_yun, current_year)

    return {
        "is_premium": is_premium,
        "start_info": {
            "start_age": start_age_text,
            "start_solar_date": yun_result.start_solar_date,
            "is_forward": yun_result.is_forward,
            "direction_text": "顺行" if yun_result.is_forward else "逆行",
        },
        "current_da_yun_index": current_da_yun_index,
        "current_year": current_year,
        "da_yun": enriched_da_yun,
    }


def _filter_free_user(da_yun: list[dict], current_year: int) -> list[dict]:
    """
    免费用户裁剪：只保留包含当前年份的大运，且该大运下只保留当前年流年。
    """
    for dy in da_yun:
        if dy["start_year"] <= current_year <= dy["end_year"]:
            filtered_liu_nian = [
                ln for ln in dy["liu_nian"]
                if ln["year"] == current_year
            ]
            dy_copy = dict(dy)
            dy_copy["liu_nian"] = filtered_liu_nian
            return [dy_copy]

    # 兜底：如果没找到当前大运（不太可能），返回空
    return []
