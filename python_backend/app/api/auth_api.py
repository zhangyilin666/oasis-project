# -*- coding: utf-8 -*-
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.logger import logger
from app.db.database import get_db
from app.models.user_model import User
from app.schemas.auth_schema import RefreshResponse, WechatLoginRequest, WechatLoginResponse
from app.services.wechat_service import authenticate_wechat_user
from app.utils.security import create_access_token, verify_token_with_grace

router = APIRouter(prefix="/api/v1/wechat", tags=["Auth"])

_bearer_scheme = HTTPBearer(auto_error=False)


@router.post(
    "/login",
    response_model=WechatLoginResponse,
    summary="微信小程序登录",
)
async def wechat_login(
    request: WechatLoginRequest,
    db: Session = Depends(get_db),
):
    """
    微信小程序 code2session 登录。

    未配置 APPID/SECRET 时自动回退 mock openid（开发阶段）。
    """
    logger.info("Login request received, code prefix: %s...", request.code[:8])

    user = authenticate_wechat_user(db=db, wechat_code=request.code)

    token = create_access_token(
        data={"sub": str(user.id), "openid": user.openid},
    )

    logger.info("Login success: user_id=%s, openid=%s", user.id, user.openid)

    return WechatLoginResponse(
        data={
            "token": token,
            "user_id": user.id,
        }
    )


@router.post(
    "/refresh",
    response_model=RefreshResponse,
    summary="刷新 JWT Token",
)
async def refresh_token(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer_scheme),
    db: Session = Depends(get_db),
):
    """
    使用当前 Token（允许过期但 30 天宽限期内）换取新 Token。

    无需前端重复登录即可延长会话。
    """
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": 401, "message": "Missing authorization token"},
        )

    token = credentials.credentials
    payload = verify_token_with_grace(token, grace_days=30)

    if payload is None:
        logger.warning("Refresh token verification failed")
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

    # 确认用户仍存在
    stmt = select(User).where(User.id == int(user_id))
    user = db.scalars(stmt).first()
    if user is None:
        logger.warning("Refresh: user not found: id=%s", user_id)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": 401, "message": "User not found"},
        )

    # 签发新 token
    new_token = create_access_token(
        data={"sub": str(user.id), "openid": user.openid},
    )

    logger.info("Token refreshed: user_id=%s", user.id)

    return RefreshResponse(
        data={
            "token": new_token,
            "user_id": user.id,
        }
    )
