# -*- coding: utf-8 -*-
"""OTP 短信验证码模型 — 用于 App 手机号登录。"""
from datetime import datetime

from sqlalchemy import Boolean, DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class OtpCode(Base):
    __tablename__ = "otp_codes"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    phone: Mapped[str] = mapped_column(
        String(20), index=True, nullable=False, comment="接收短信的手机号"
    )
    code: Mapped[str] = mapped_column(
        String(6), nullable=False, comment="6 位数字验证码"
    )
    purpose: Mapped[str] = mapped_column(
        String(20), default="login", server_default="'login'",
        nullable=False, comment="用途: login | bind | reset"
    )
    expires_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, comment="验证码过期时间（创建后 5 分钟）"
    )
    used: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default="0",
        nullable=False, comment="是否已使用"
    )
    created_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), nullable=False
    )
