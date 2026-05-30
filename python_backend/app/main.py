# -*- coding: utf-8 -*-
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.auth_api import router as auth_router
from app.api.oasis_api import router as oasis_router
from app.core.config import settings
from app.core.exceptions import global_exception_handler
from app.core.logger import logger
from app.db.base import Base
from app.db.database import engine


# 应用启动时自动创建所有表（幂等，已存在的表不重建）
@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables ensured.")
    yield


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(oasis_router)
app.include_router(auth_router)
app.add_exception_handler(Exception, global_exception_handler)


@app.get("/")
async def root():
    return {"code": 200, "data": None, "message": "Oasis Backend Running"}
