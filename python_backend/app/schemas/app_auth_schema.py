# -*- coding: utf-8 -*-
"""App 认证相关的 Pydantic 请求/响应模型。"""
from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# 请求模型
# ---------------------------------------------------------------------------


class AnonymousLoginRequest(BaseModel):
    """设备匿名登录请求"""
    device_id: str = Field(
        ...,
        min_length=8,
        max_length=64,
        description="设备唯一标识（客户端生成的 UUID）",
    )


# ---------------------------------------------------------------------------
# 响应模型
# ---------------------------------------------------------------------------


class AnonymousLoginResponse(BaseModel):
    """匿名登录响应"""
    code: int = 200
    message: str = "ok"
    data: dict  # {"token": str, "user_id": int}


class AppRefreshResponse(BaseModel):
    """Token 刷新响应"""
    code: int = 200
    message: str = "ok"
    data: dict  # {"token": str, "user_id": int}
