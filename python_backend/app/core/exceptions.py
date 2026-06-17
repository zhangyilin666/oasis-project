import traceback

from fastapi import Request
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.core.logger import logger


async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """
    全局未捕获异常处理器。

    - 生产环境 (DEBUG=False)：返回通用错误消息，完整堆栈写入日志。
    - 开发环境 (DEBUG=True)：返回具体异常类型与消息，便于调试。
    """
    # 记录完整请求上下文 + 堆栈
    logger.exception(
        "Unhandled exception on %s %s: %s",
        request.method,
        request.url.path,
        exc,
        exc_info=exc,
    )

    if settings.DEBUG:
        detail = f"{type(exc).__name__}: {exc}"
    else:
        detail = "Internal Server Error"

    return JSONResponse(
        status_code=500,
        content={
            "code": 500,
            "data": None,
            "message": detail,
        },
    )
