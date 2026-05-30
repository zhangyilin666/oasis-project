# -*- coding: utf-8 -*-
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.logger import logger
from app.db.database import get_db
from app.schemas.auth_schema import WechatLoginRequest, WechatLoginResponse
from app.services.wechat_service import authenticate_wechat_user
from app.utils.security import create_access_token

router = APIRouter(prefix="/api/v1/wechat", tags=["Auth"])


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

    当前阶段使用 mock openid 映射（开发阶段无需真实微信接口）。
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
