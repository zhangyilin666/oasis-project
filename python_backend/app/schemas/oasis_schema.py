from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, field_validator


class UserInput(BaseModel):
    name: str = Field(..., min_length=1, max_length=50)
    birth_date: str = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$")
    birth_time: str = Field(..., pattern=r"^\d{2}:\d{2}$")
    gender: str = Field(..., min_length=1)
    location: str = Field(..., min_length=1, max_length=100)
    is_solar_time: bool = False

    @field_validator("birth_date")
    @classmethod
    def validate_birth_date(cls, v: str) -> str:
        try:
            datetime.strptime(v, "%Y-%m-%d")
        except ValueError:
            raise ValueError("birth_date must be a valid date in YYYY-MM-DD format")
        return v

    @field_validator("birth_time")
    @classmethod
    def validate_birth_time(cls, v: str) -> str:
        try:
            datetime.strptime(v, "%H:%M")
        except ValueError:
            raise ValueError("birth_time must be a valid time in HH:mm format")
        return v


class OasisResponse(BaseModel):
    code: int
    data: Optional[dict] = None
    message: str = "ok"


class WechatLoginRequest(BaseModel):
    """微信小程序登录请求"""
    code: str = Field(..., min_length=1, max_length=256)

    @field_validator("code")
    @classmethod
    def validate_code_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("code must not be empty or whitespace")
        return v


class LoginData(BaseModel):
    """登录成功返回的业务数据"""
    token: str
    user_id: int
