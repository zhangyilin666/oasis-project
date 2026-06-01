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


def verify_token_with_grace(token: str, grace_days: int = 30) -> dict | None:
    """
    宽限期内的 Token 验证（用于刷新端点）。

    与 verify_token 的区别：
    - 正常未过期的 token → 返回 payload
    - 过期但在 grace_days 天内的 token → 返回 payload（允许续签）
    - 超过宽限期 / 签名无效 / 格式错误 → 返回 None

    Args:
        token: 客户端传来的 JWT 字符串。
        grace_days: 过期后仍接受的最大天数，默认 30 天。

    Returns:
        解码成功返回 payload 字典；否则返回 None。
    """
    try:
        # 先尝试正常解码（未过期的 token）
        return jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
        )
    except ExpiredSignatureError:
        # 过期了 — 但验证签名是否正确，并检查是否在宽限期内
        try:
            payload: dict = jwt.decode(
                token,
                settings.JWT_SECRET_KEY,
                algorithms=[settings.JWT_ALGORITHM],
                options={"verify_exp": False},
            )
        except PyJWTError:
            # 签名无效 / 格式错误 — 拒绝
            return None

        # 检查过期时间是否在宽限期内
        exp_timestamp = payload.get("exp")
        if exp_timestamp is None:
            return None

        exp_time = datetime.fromtimestamp(exp_timestamp, tz=timezone.utc)
        grace_deadline = datetime.now(timezone.utc) - timedelta(days=grace_days)

        if exp_time >= grace_deadline:
            return payload

        return None
    except PyJWTError:
        return None
