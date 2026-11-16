# -*- coding: utf-8 -*-
"""每日一签。同一用户在中国自然日只保留一支。"""
from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class FortuneStick(Base):
    """当天抽中的签和解说。不保存用户默念的问题。"""

    __tablename__ = "fortune_sticks"
    __table_args__ = (
        UniqueConstraint("user_id", "stick_date", name="uq_fortune_stick_user_date"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    stick_date: Mapped[date] = mapped_column(Date(), nullable=False)
    sign_number: Mapped[int] = mapped_column(Integer(), nullable=False)
    grade: Mapped[str] = mapped_column(String(8), nullable=False)
    title: Mapped[str] = mapped_column(String(64), nullable=False)
    poem: Mapped[str] = mapped_column(Text(), nullable=False)
    line: Mapped[str] = mapped_column(String(40), nullable=False)
    plain: Mapped[str] = mapped_column(Text(), nullable=False)
    cat: Mapped[str] = mapped_column(Text(), nullable=False)
    used_fallback: Mapped[bool] = mapped_column(Boolean(), nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
