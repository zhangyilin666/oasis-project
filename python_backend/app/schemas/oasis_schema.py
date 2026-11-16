from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from typing import Optional

from pydantic import BaseModel, Field, field_validator, model_validator


class UserInput(BaseModel):
    name: str = Field(..., min_length=1, max_length=50)
    birth_date: str = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$")
    birth_time: str = Field(..., pattern=r"^\d{2}:\d{2}$")
    gender: str = Field(..., min_length=1)
    location: str = Field(..., min_length=1, max_length=100)
    is_solar_time: bool = True

    @field_validator("name", "location")
    @classmethod
    def validate_text(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("不能为空")
        return v.strip()

    @field_validator("gender")
    @classmethod
    def validate_gender(cls, v: str) -> str:
        if v not in ("男", "女", "male", "female"):
            raise ValueError("gender must be 男 or 女")
        return v

    @field_validator("birth_date")
    @classmethod
    def validate_birth_date(cls, v: str) -> str:
        try:
            datetime.strptime(v, "%Y-%m-%d")
        except ValueError:
            raise ValueError("birth_date must be a valid date in YYYY-MM-DD format")
        return v

    @model_validator(mode="after")
    def validate_birth_date_range(self) -> "UserInput":
        birth_date = date.fromisoformat(self.birth_date)
        today_in_china = datetime.now(timezone(timedelta(hours=8))).date()
        if birth_date > today_in_china:
            raise ValueError("birth_date cannot be in the future")
        if self.is_solar_time and birth_date < date(1900, 1, 1):
            raise ValueError("solar birth_date must be on or after 1900-01-01")
        return self

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


class LoginData(BaseModel):
    """登录成功返回的业务数据"""
    token: str
    user_id: int
