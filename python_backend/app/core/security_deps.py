# -*- coding: utf-8 -*-
"""
JWT 鉴权依赖注入。

提供 FastAPI Depends 函数，用于保护需要登录的端点。

用法::

    from app.core.security_deps import get_current_user
    from app.models.user_model import User

    @router.get("/protected")
    async def protected_route(current_user: User = Depends(get_current_user)):
        return {"user_id": current_user.id}
"""
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.logger import logger
from app.db.database import get_db
from app.models.user_model import User
from app.services.user_identity import resolve_user_by_id
from app.utils.security import verify_token

# Bearer Token 提取器（自动从 Authorization header 解析）
_bearer_scheme = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    """
    从请求的 Authorization Bearer Token 中解析当前用户。

    流程：
    1. 提取 Authorization header
    2. JWT 解码校验
    3. 从 payload 获取 user_id
    4. 查询数据库返回 User 对象

    Raises:
        HTTPException 401: Token 缺失 / 过期 / 无效 / 用户不存在。

    Returns:
        User ORM 对象，可直接注入到端点使用。
    """
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": 401, "message": "Missing authorization token"},
        )

    token = credentials.credentials
    payload = verify_token(token)

    if payload is None:
        logger.warning("Token verification failed")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": 401, "message": "Invalid or expired token"},
        )

    user_id = payload.get("sub")
    if user_id is None:
        logger.warning("Token payload missing 'sub' field")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": 401, "message": "Invalid token payload"},
        )

    # 查询用户
    user = resolve_user_by_id(db, user_id)

    if user is None:
        logger.warning("User not found: id=%s (valid token but user deleted?)", user_id)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": 401, "message": "User not found"},
        )

    return user
