# -*- coding: utf-8 -*-
"""每日运势模型 — 每个用户每天一条缓存记录。"""
from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class DailyFortune(Base):
    """
    每日个性化运势。

    生成策略：用户当天首次访问首页时触发 AI 生成，
    后续访问直接返回缓存。联合唯一索引 (user_id, fortune_date)
    保证同一用户同一天只有一条记录。
    """

    __tablename__ = "daily_fortunes"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True, index=True)

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
        comment="关联用户ID",
    )

    report_id: Mapped[int] = mapped_column(
        ForeignKey("reports.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
        comment="关联八字报告ID（用于提取八字数据）",
    )

    fortune_date: Mapped[date] = mapped_column(
        Date(),
        nullable=False,
        index=True,
        comment="运势日期（今天）",
    )

    # -- 流日基础数据 --
    day_gan_zhi: Mapped[str] = mapped_column(
        String(10),
        nullable=False,
        comment="今日干支，如 壬寅",
    )

    day_relation: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        comment="今日日干与日主的十神关系，如 偏印",
    )

    # -- 冲合信息 --
    clash_info: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
        comment="日支冲合提示，如 子午冲·注意口舌",
    )

    # -- AI 生成内容 --
    fortune_text: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        comment="AI生成的运势解读（200字以内）",
    )

    lucky_color: Mapped[str | None] = mapped_column(
        String(20),
        nullable=True,
        comment="幸运色",
    )

    lucky_direction: Mapped[str | None] = mapped_column(
        String(20),
        nullable=True,
        comment="幸运方位",
    )

    warning: Mapped[str | None] = mapped_column(
        String(200),
        nullable=True,
        comment="注意事项/提醒",
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        comment="生成时间",
    )

    # 同一用户同一天唯一
    __table_args__ = (
        UniqueConstraint("user_id", "fortune_date", name="uq_daily_fortune_user_date"),
    )
