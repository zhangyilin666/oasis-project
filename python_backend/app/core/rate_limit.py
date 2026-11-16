# -*- coding: utf-8 -*-
"""
请求速率限制依赖注入。

对昂贵端点（如 /analyze）施加每日频次限制，
防止 API 额度滥用与服务过载。

普通用户按每日限额处理（默认 5 次/天），数据库标记的管理员不受次数限制。

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

from datetime import datetime, timezone

from fastapi import Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security_deps import get_current_user
from app.db.database import get_db
from app.models.report_model import Report


def check_daily_analyze_limit(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    """
    校验当前用户每日分析限额。

    普通用户按免费用户每日限额处理（默认 5 次/天）。
    管理员身份来自鉴权时读取的数据库用户，不信任客户端角色声明。

    Raises:
        HTTPException 429: 今日限额已用完。
    """
    if current_user.is_admin:
        return

    user_id = current_user.id

    limit = settings.RATE_LIMIT_ANALYZE_PER_DAY
    if limit <= 0:
        return  # 无限制

    # MySQL 会话使用 UTC；自然日额度按中国时间划分。
    from datetime import timedelta
    from app.models.user_model import User
    china = timezone(timedelta(hours=8))
    today = datetime.now(china).date()
    start_of_day = datetime.combine(today, datetime.min.time(), tzinfo=china).astimezone(timezone.utc).replace(tzinfo=None)

    # 持有用户行锁直至调用方创建报告并提交，避免并发请求同时通过限额。
    db.execute(select(User.id).where(User.id == user_id).with_for_update()).first()
    # Deleted reports still count: deletion clears content, not accepted AI submissions.
    total = db.scalar(select(func.count()).select_from(Report).where(
        Report.user_id == user_id,
        Report.created_at >= start_of_day,
    )) or 0

    if total >= limit:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={
                "code": 429,
                "message": f"今日免费分析次数已达上限（{limit}次/天），请明天再试",
            },
        )
