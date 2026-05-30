import time
from datetime import datetime, timedelta, timezone

import jwt
from jwt import ExpiredSignatureError, PyJWTError

from app.core.config import settings


def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    """
    签发 JWT Access Token。

    Args:
        data: 要编码到 JWT payload 中的业务数据（如 openid、sub）。
              传入的字典不会被修改。
        expires_delta: 自定义过期时长；None 则使用配置中的默认值。

    Returns:
        编码后的 JWT 字符串。
    """
    payload = {**data}

    now = datetime.now(timezone.utc)
    delta = expires_delta or timedelta(minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES)

    payload.setdefault("iat", int(time.time()))
    payload.setdefault("exp", now + delta)

    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def verify_token(token: str) -> dict | None:
    """
    验证并解码 JWT Token。

    Args:
        token: 客户端传来的 JWT 字符串。

    Returns:
        解码成功返回 payload 字典；过期、篡改或格式错误返回 None。
    """
    try:
        payload: dict = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
        )
        return payload
    except ExpiredSignatureError:
        return None
    except PyJWTError:
        return None
