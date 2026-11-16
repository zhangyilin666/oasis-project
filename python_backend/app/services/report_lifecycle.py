"""Expire abandoned work without touching live tasks or completed reports."""
from datetime import datetime, timedelta, timezone
from sqlalchemy import select, update
from app.core.config import settings
from app.models.report_model import Report
from app.models.report_status import ReportStatus


def expire_stale_reports(db, user_id: int) -> None:
    cutoff = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(minutes=settings.REPORT_TIMEOUT_MINUTES)
    stale_filter = (
        Report.user_id == user_id,
        Report.status.in_([ReportStatus.PENDING, ReportStatus.PROCESSING]),
        Report.updated_at < cutoff,
    )
    # 普通轮询只读；避免无过期任务时 UPDATE 扫描锁与后台写入形成死锁。
    stale_ids = db.scalars(select(Report.id).where(*stale_filter).order_by(Report.id)).all()
    if not stale_ids:
        return
    result = db.execute(update(Report).where(
        Report.id.in_(stale_ids), *stale_filter,
    ).values(status=ReportStatus.FAILED, error_message="处理已中断或超时，请重新分析。"))
    db.commit()
    if result.rowcount:
        db.expire_all()
