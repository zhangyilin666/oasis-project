# -*- coding: utf-8 -*-
"""
App 认证 API。

提供设备匿名登录 + Token 刷新，用于 iOS / Android 原生 App。

端点：
    POST /api/v1/app/anonymous-login — 设备匿名登录
    POST /api/v1/app/refresh         — JWT Token 刷新
    GET  /api/v1/app/me              — 当前账号身份
"""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.logger import logger
from app.core.security_deps import get_current_user
from app.db.database import get_db
from app.models.user_model import User
from app.schemas.app_auth_schema import (
    AnonymousLoginRequest,
    AnonymousLoginResponse,
    AppRefreshResponse,
)
from app.schemas.oasis_schema import OasisResponse
from app.services.user_identity import resolve_user_by_id
from app.utils.security import create_access_token, verify_token_with_grace

router = APIRouter(prefix="/api/v1/app", tags=["App Auth"])

_bearer_scheme = HTTPBearer(auto_error=False)


@router.get("/me", response_model=OasisResponse, summary="当前账号身份")
def current_account(current_user: User = Depends(get_current_user)):
    return OasisResponse(code=200, data={"user_id": current_user.id, "is_admin": current_user.is_admin})


# ---------------------------------------------------------------------------
# 设备匿名登录
# ---------------------------------------------------------------------------


@router.post(
    "/anonymous-login",
    response_model=AnonymousLoginResponse,
    summary="设备匿名登录（无需手机号）",
)
async def anonymous_login(
    request: AnonymousLoginRequest,
    db: Session = Depends(get_db),
):
    """
    使用设备唯一标识登录。

    流程：
    1. 查找已有 device_id 用户，不存在则自动创建
    2. 签发 7 天有效期 JWT Token

    无需短信验证码，无需手机号。首次使用时自动注册。
    """
    logger.info("Anonymous login request: device_id=%s...", request.device_id[:8])

    stmt = select(User).where(User.device_id == request.device_id)
    user = db.scalars(stmt).first()

    if user is not None:
        user.last_login_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(user)
        logger.info("Existing device user logged in: user_id=%s", user.id)
    else:
        # 用 merge 方式避免 race condition 导致的 session 异常
        try:
            user = User(
                device_id=request.device_id,
                last_login_at=datetime.now(timezone.utc),
            )
            db.add(user)
            db.commit()
            db.refresh(user)
            logger.info("New anonymous user created: user_id=%s", user.id)
        except IntegrityError as e:
            # 最可能原因：并发插入同 device_id，另一请求已创建用户
            logger.warning(
                "IntegrityError (race condition?) for device_id=%s: %s",
                request.device_id[:8], str(e),
            )
            db.rollback()
            db.expire_all()
            # 用新事务重新查询
            stmt = select(User).where(User.device_id == request.device_id)
            user = db.scalars(stmt).first()
            if user is None:
                # 不应发生：记录详细信息便于排查
                logger.error(
                    "CRITICAL: user not found after IntegrityError. "
                    "device_id=%s, error=%s",
                    request.device_id, str(e),
                )
                return AnonymousLoginResponse(
                    code=500,
                    message="注册失败，请重试",
                    data={},
                )
            user.last_login_at = datetime.now(timezone.utc)
            db.commit()
            db.refresh(user)
            logger.info("Race condition resolved: user_id=%s", user.id)
        except Exception as e:
            db.rollback()
            logger.exception(
                "Failed to create user for device_id=%s: %s",
                request.device_id[:8], str(e),
            )
            return AnonymousLoginResponse(
                code=500,
                message="注册失败，请稍后再试",
                data={},
            )

    token = create_access_token(data={"sub": str(user.id)})

    logger.info("Anonymous login success: user_id=%s", user.id)

    return AnonymousLoginResponse(
        data={
            "token": token,
            "user_id": user.id,
        }
    )


# ---------------------------------------------------------------------------
# Token 刷新
# ---------------------------------------------------------------------------


@router.post("/restore", response_model=AnonymousLoginResponse)
def restore_account(request: AnonymousLoginRequest, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.device_id == request.device_id))
    if user is None:
        raise HTTPException(404, detail={"code": 404, "message": "恢复码不存在，请检查是否完整"})
    return AnonymousLoginResponse(data={"token": create_access_token({"sub": str(user.id)}), "user_id": user.id})


@router.post(
    "/refresh",
    response_model=AppRefreshResponse,
    summary="刷新 JWT Token",
)
async def app_refresh_token(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer_scheme),
    db: Session = Depends(get_db),
):
    """
    使用当前 Token（允许过期但 30 天宽限期内）换取新 Token。
    """
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": 401, "message": "Missing authorization token"},
        )

    token = credentials.credentials
    payload = verify_token_with_grace(token, grace_days=30)

    if payload is None:
        logger.warning("App refresh: token verification failed")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "code": 401,
                "message": "Invalid, expired (beyond grace period), or tampered token",
            },
        )

    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": 401, "message": "Invalid token payload"},
        )

    user = resolve_user_by_id(db, user_id)
    if user is None:
        logger.warning("App refresh: user not found: id=%s", user_id)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": 401, "message": "User not found"},
        )

    new_token = create_access_token(data={"sub": str(user.id)})

    logger.info("App token refreshed: user_id=%s", user.id)

    return AppRefreshResponse(
        data={
            "token": new_token,
            "user_id": user.id,
        }
    )
