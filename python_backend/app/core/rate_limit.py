# -*- coding: utf-8 -*-
"""
请求速率限制依赖注入。

对昂贵端点（如 /analyze）施加每日频次限制，
防止 API 额度滥用与服务过载。

所有用户统一按每日限额处理（默认 5 次/天）。

用法::

    from app.core.rate_limit import check_daily_analyze_limit

    @router.post("/api/v1/wechat/oasis/analyze")
    async def analyze(
        ...,
        _rate_ok: None = Depends(check_daily_analyze_limit),
    ):
        ...
"""
from __future__ import annotations

from datetime import date, datetime, timezone

from fastapi import Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.logger import logger
from app.core.security_deps import get_current_user
from app.db.database import get_db
from app.models.log_model import AnalysisLog
from app.models.report_model import Report
from app.models.report_status import ReportStatus


async def check_daily_analyze_limit(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    """
    校验当前用户每日分析限额。

    统一按免费用户每日限额处理（默认 5 次/天）。

    Raises:
        HTTPException 429: 今日限额已用完。
    """
    user_id = current_user.id

    limit = settings.RATE_LIMIT_ANALYZE_PER_DAY
    if limit <= 0:
        return  # 无限制

    today = date.today()
    start_of_day = datetime(today.year, today.month, today.day, tzinfo=timezone.utc)

    count = db.scalar(
        select(func.count())
        .select_from(AnalysisLog)
        .where(
            AnalysisLog.user_id == user_id,
            AnalysisLog.status == "success",
            AnalysisLog.created_at >= start_of_day,
        )
    )

    # 同时统计 pending/processing 的报告数（防止排队刷量）
    pending_count = db.scalar(
        select(func.count())
        .select_from(Report)
        .where(
            Report.user_id == user_id,
            Report.status.in_([ReportStatus.PENDING, ReportStatus.PROCESSING]),
            Report.created_at >= start_of_day,
        )
    )

    total = (count or 0) + (pending_count or 0)

    if total >= limit:
        logger.warning(
            "Rate limit hit: user_id=%s total=%d (success=%d, pending=%d) limit=%d",
            user_id,
            total,
            count or 0,
            pending_count or 0,
            limit,
        )
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={
                "code": 429,
                "message": f"今日免费分析次数已达上限（{limit}次/天），请明天再试",
            },
        )
