# -*- coding: utf-8 -*-
from datetime import datetime

from sqlalchemy import String, Text, JSON, ForeignKey, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


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
    calendar_data: Mapped[dict] = mapped_column(
        JSON,
        nullable=False,
        comment="lunar-python 排盘结果"
    )
    ai_analysis: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        comment="AI生成运势分析"
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

    # 反向关联：一个 Report 对应多条 AnalysisLog
    analysis_logs = relationship(
        "AnalysisLog", back_populates="report", lazy="select"
    )
