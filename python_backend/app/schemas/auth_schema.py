# -*- coding: utf-8 -*-
from pydantic import BaseModel, Field


class WechatLoginRequest(BaseModel):
    """微信小程序登录请求"""
    code: str = Field(..., min_length=1, max_length=256, description="微信 login 返回的 code")


class WechatLoginResponse(BaseModel):
    """微信小程序登录响应"""
    code: int = 200
    message: str = "ok"
    data: dict  # {"token": str, "user_id": int}
