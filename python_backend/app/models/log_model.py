# -*- coding: utf-8 -*-
from datetime import datetime

from sqlalchemy import String, Integer, ForeignKey, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class AnalysisLog(Base):
    __tablename__ = "analysis_logs"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True, index=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
        comment="关联用户ID"
    )
    report_id: Mapped[int | None] = mapped_column(
        ForeignKey("reports.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        comment="关联报告ID（删除报告时保留日志，仅置空）"
    )
    model_name: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        index=True,
        comment="使用的LLM模型名称"
    )
    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="success",
        comment="调用状态: success / failed / timeout"
    )
    prompt_tokens: Mapped[int | None] = mapped_column(
        nullable=True,
        default=None,
        comment="Prompt token 用量（失败时为 NULL）"
    )
    completion_tokens: Mapped[int | None] = mapped_column(
        nullable=True,
        default=None,
        comment="Completion token 用量（失败时为 NULL）"
    )
    total_tokens: Mapped[int | None] = mapped_column(
        nullable=True,
        default=None,
        comment="总 token 用量（失败时为 NULL）"
    )
    latency_ms: Mapped[int] = mapped_column(
        nullable=False,
        comment="API响应延迟(毫秒)"
    )
    trace_id: Mapped[str | None] = mapped_column(
        String(64),
        nullable=True,
        index=True,
        comment="请求追踪ID，用于串联日志"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        index=True,
        comment="记录创建时间"
    )

    # 反向关联
    report = relationship("Report", back_populates="analysis_logs", lazy="select")
