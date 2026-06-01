# -*- coding: utf-8 -*-
"""
知识库应用级生命周期管理。

在 FastAPI lifespan 中调用 ``init_kb()`` 初始化，端点通过
``Depends(get_kb)`` 注入。

用法::

    # main.py lifespan
    from app.core.kb_provider import init_kb
    init_kb()

    # API endpoint
    from app.core.kb_provider import get_kb

    @router.post("/analyze")
    async def analyze(
        ...,
        kb: KnowledgeBase = Depends(get_kb),
    ):
        results = kb.search("五行", top_k=3)
"""
from __future__ import annotations

from pathlib import Path
from typing import Optional

from app.core.logger import logger
from app.services.rag_service import KnowledgeBase

_kb: Optional[KnowledgeBase] = None


def init_kb(data_dir: Optional[Path] = None) -> KnowledgeBase:
    """
    初始化知识库实例（应用启动时调用一次）。

    Args:
        data_dir: 知识库文档目录。默认自动解析到项目根下的 data_center/knowledge。

    Returns:
        已加载文档的 KnowledgeBase 实例。
    """
    global _kb
    _kb = KnowledgeBase(data_dir=data_dir)
    count = _kb.load_all()
    logger.info("KnowledgeBase initialized: %d documents loaded", count)
    return _kb


def get_kb() -> KnowledgeBase:
    """
    获取已初始化的知识库实例（供 FastAPI Depends 注入）。

    Raises:
        RuntimeError: 如果未先调用 init_kb()。
    """
    if _kb is None:
        raise RuntimeError(
            "KnowledgeBase not initialized — call init_kb() during application startup"
        )
    return _kb


def reload_kb(data_dir: Optional[Path] = None) -> KnowledgeBase:
    """
    强制重建知识库索引（管理端点调用，如 POST /admin/reload-kb）。

    等效于重新调用 init_kb()。
    """
    return init_kb(data_dir=data_dir)
