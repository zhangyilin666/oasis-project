# -*- coding: utf-8 -*-
"""
微信小程序认证服务。

通过 WeChat code2session API 换取 openid，查找或创建用户。

开发阶段：未配置 APPID/SECRET 时自动回退到 mock openid。
"""
from __future__ import annotations

import json
from typing import Optional
from urllib.error import URLError
from urllib.request import urlopen

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.logger import logger
from app.models.user_model import User

# ---------------------------------------------------------------------------
# WeChat code2session
# ---------------------------------------------------------------------------

WECHAT_CODE2SESSION_URL = "https://api.weixin.qq.com/sns/jscode2session"


def _code2session(code: str) -> dict:
    """
    调用微信 code2session 接口换取 openid + session_key。

    未配置 APPID/SECRET 时回退到 mock 模式（开发阶段）。

    Args:
        code: 小程序端 wx.login() 返回的临时 code。

    Returns:
        {"openid": str, "session_key": str, "unionid"?: str}

    Raises:
        RuntimeError: 网络错误。
        ValueError: WeChat API 返回 errcode（code 无效或已过期）。
    """
    appid = settings.WECHAT_APPID
    secret = settings.WECHAT_SECRET

    if not appid or not secret:
        logger.debug("WECHAT_APPID/SECRET not configured, using mock openid")
        return {
            "openid": f"mock_openid_{code}",
            "session_key": "mock_session_key",
        }

    url = (
        f"{WECHAT_CODE2SESSION_URL}"
        f"?appid={appid}"
        f"&secret={secret}"
        f"&js_code={code}"
        f"&grant_type=authorization_code"
    )

    logger.debug("Calling WeChat code2session...")

    try:
        with urlopen(url, timeout=10) as response:
            data = json.loads(response.read().decode("utf-8"))
    except URLError as exc:
        logger.error("WeChat code2session network error: %s", exc)
        raise RuntimeError(f"WeChat code2session network error: {exc}") from exc

    errcode = data.get("errcode", 0)
    if errcode != 0:
        errmsg = data.get("errmsg", "unknown error")
        logger.error("WeChat code2session API error: errcode=%s errmsg=%s", errcode, errmsg)
        raise ValueError(
            f"WeChat code2session error: {errmsg} (errcode={errcode})"
        )

    logger.debug("WeChat code2session success: openid=%s", data.get("openid", "")[:8])
    return data


# ---------------------------------------------------------------------------
# 用户认证
# ---------------------------------------------------------------------------

def authenticate_wechat_user(db: Session, wechat_code: str) -> User:
    """
    通过微信小程序 code 认证用户，若不存在则自动创建。

    流程：
    1. code2session 换取微信 openid
    2. 查询数据库是否存在该 openid
    3. 存在则返回已有用户，不存在则创建新用户并落库

    Args:
        db: 数据库会话。
        wechat_code: 微信小程序 wx.login() 返回的临时 code。

    Returns:
        已存在或新创建的 User 对象。

    Raises:
        ValueError: code 无效或 WeChat API 返回错误。
        RuntimeError: WeChat 服务网络不可达。
    """
    session_data = _code2session(wechat_code)
    openid: str = session_data["openid"]

    # SQLAlchemy 2.0 现代语法：查询已有用户
    stmt = select(User).where(User.openid == openid)
    user = db.scalars(stmt).first()

    if user is not None:
        logger.debug("Existing user logged in: openid=%s", openid)
        return user

    # 用户不存在 → 创建新用户
    user = User(openid=openid)
    db.add(user)

    try:
        db.commit()
        db.refresh(user)
        logger.info("New user created: openid=%s, id=%s", openid, user.id)
        return user
    except IntegrityError:
        # 并发场景：另一个请求抢先创建了同 openid 的用户
        db.rollback()
        logger.warning(
            "Race condition on openid=%s, retrying query after rollback", openid
        )
        stmt = select(User).where(User.openid == openid)
        user = db.scalars(stmt).first()
        if user is None:
            raise RuntimeError(
                "Unexpected: openid=%s not found after IntegrityError rollback"
                % openid
            )
        return user
    except Exception:
        db.rollback()
        logger.exception("Failed to create user for openid=%s", openid)
        raise
