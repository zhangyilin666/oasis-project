# -*- coding: utf-8 -*-
from datetime import datetime

from sqlalchemy import String, Text, JSON, ForeignKey, DateTime, Enum as SQLEnum, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.report_status import ReportStatus


class Report(Base):
    __tablename__ = "reports"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True, index=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
        comment="关联用户ID"
    )
    birth_info: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        comment="用户输入出生时间字符串"
    )
    calendar_data: Mapped[dict | None] = mapped_column(
        JSON,
        nullable=True,
        comment="lunar-python 排盘结果（pending/processing 时为 NULL）"
    )
    ai_analysis: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="AI生成运势分析（pending/processing 时为 NULL）"
    )
    input_data: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    status: Mapped[ReportStatus] = mapped_column(
        SQLEnum(ReportStatus),
        nullable=False,
        default=ReportStatus.PENDING,
        index=True,
        comment="报告状态: PENDING / PROCESSING / COMPLETED / FAILED"
    )
    error_message: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="失败原因（仅 status=FAILED 时有值）"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        comment="创建时间"
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
        comment="最后更新时间（重新生成分析时更新）"
    )
    # Retain only the submission record after deletion so daily quotas cannot be reset.
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # 反向关联：一个 Report 对应多条 AnalysisLog
    analysis_logs = relationship(
        "AnalysisLog", back_populates="report", lazy="select"
    )
