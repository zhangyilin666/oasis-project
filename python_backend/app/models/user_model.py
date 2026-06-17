from datetime import datetime

from sqlalchemy import Boolean, DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    # openid：微信小程序用户唯一标识（App 手机号用户为 NULL）
    openid: Mapped[str | None] = mapped_column(
        String(128), unique=True, index=True, nullable=True
    )
    # device_id：App 匿名登录设备标识（唯一，允许 NULL）
    device_id: Mapped[str | None] = mapped_column(
        String(64), unique=True, index=True, nullable=True, comment="设备唯一标识（匿名登录用）"
    )
    # phone：App 手机号登录（唯一，允许 NULL — 设备用户无手机号）
    phone: Mapped[str | None] = mapped_column(
        String(20), unique=True, index=True, nullable=True, comment="手机号（App 登录用）"
    )
    phone_verified: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default="0", nullable=False, comment="手机号是否已验证"
    )
    nickname: Mapped[str | None] = mapped_column(String(255), nullable=True)
    avatar_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    last_login_at: Mapped[datetime | None] = mapped_column(
        DateTime, nullable=True, comment="最近登录时间"
    )
    created_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
