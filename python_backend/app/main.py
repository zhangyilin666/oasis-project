# -*- coding: utf-8 -*-
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.auth_api import router as auth_router
from app.api.app_auth_api import router as app_auth_router
from app.api.oasis_api import router as oasis_router
from app.api.divination_api import router as divination_router
from app.core.config import settings
from app.core.exceptions import global_exception_handler
from app.core.kb_provider import init_kb
from app.core.logger import logger
from app.db.base import Base
from app.db.database import engine


# 应用启动时不调用 create_all，改为通过 Alembic 管理 Schema 变更。
# 部署流程：先执行 `alembic upgrade head`，再启动应用。
# 同时加载 RAG 知识库（应用级单例，整个进程生命周期内只加载一次）
@asynccontextmanager
async def lifespan(app: FastAPI):
    # 启动检查：确认 alembic_version 表存在（即迁移已执行）
    from sqlalchemy import text
    from app.db.database import engine

    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1 FROM alembic_version LIMIT 1"))
        logger.info("Alembic migrations verified: alembic_version table exists.")
    except Exception:
        logger.warning(
            "Alembic_version table NOT found! "
            "Did you forget to run 'alembic upgrade head'?"
        )

    init_kb()
    logger.info("Knowledge base initialized.")
    yield


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    lifespan=lifespan,
)

# CORS 配置：从 settings.CORS_ORIGINS 读取允许来源
# 同域网页部署不需要 CORS；跨域客户端应配置明确来源。
_cors_raw = settings.CORS_ORIGINS.strip()
if not _cors_raw:
    logger.warning("CORS_ORIGINS not set, CORS middleware DISABLED")
elif _cors_raw == "*":
    _origins = ["*"]
    _allow_credentials = False
    logger.warning("CORS_ORIGINS=* (allow all origins), only use in development!")
else:
    _origins = [o.strip() for o in _cors_raw.split(",") if o.strip()]
    _allow_credentials = True
    logger.info("CORS enabled for origins: %s", _origins)

if _cors_raw:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=_origins,
        allow_credentials=_allow_credentials,
        allow_methods=["GET", "POST", "PUT", "DELETE"],
        allow_headers=["Authorization", "Content-Type"],
    )

app.include_router(oasis_router)
app.include_router(divination_router)
app.include_router(auth_router)
app.include_router(app_auth_router)  # App 手机号认证路由
app.add_exception_handler(Exception, global_exception_handler)


@app.get("/")
async def root():
    return {"code": 200, "data": None, "message": "猫来运转 Backend Running"}
