# -*- coding: utf-8 -*-
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.logger import logger
from app.models.user_model import User


def authenticate_wechat_user(db: Session, wechat_code: str) -> User:
    """
    通过微信小程序 code 认证用户，若不存在则自动创建。

    流程：
    1. 根据 wechat_code 生成 mock openid（开发阶段替代真实 code2session）
    2. 查询数据库是否存在该 openid
    3. 存在则返回已有用户，不存在则创建新用户并落库

    Args:
        db: 数据库会话
        wechat_code: 微信小程序 login 返回的 code

    Returns:
        已存在或新创建的 User 对象
    """
    openid = f"mock_openid_{wechat_code}"

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
