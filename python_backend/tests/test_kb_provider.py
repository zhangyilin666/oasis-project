# -*- coding: utf-8 -*-
"""kb_provider 生命周期测试。"""
from __future__ import annotations

import pytest

from app.core.kb_provider import get_kb, init_kb, reload_kb
from app.services.rag_service import KnowledgeBase


# ---------------------------------------------------------------------------
# 重置 fixture — 每个测试需要独立的 _kb 状态
# ---------------------------------------------------------------------------

@pytest.fixture(autouse=True)
def reset_kb_global():
    """每个测试前后重置 kb_provider 的全局 _kb 状态。"""
    import app.core.kb_provider as mod
    original = mod._kb
    mod._kb = None
    yield
    mod._kb = original


# ---------------------------------------------------------------------------
# 测试
# ---------------------------------------------------------------------------

class TestKbProviderLifecycle:
    """init_kb → get_kb → reload_kb 生命周期。"""

    def test_get_kb_before_init_raises_runtime_error(self):
        """未初始化时调用 get_kb() 抛出 RuntimeError。"""
        with pytest.raises(RuntimeError, match="not initialized"):
            get_kb()

    def test_init_kb_returns_knowledge_base_instance(self, temp_knowledge_dir):
        """init_kb() 返回 KnowledgeBase 实例。"""
        kb = init_kb(data_dir=temp_knowledge_dir)
        assert isinstance(kb, KnowledgeBase)
        assert kb.document_count > 0

    def test_get_kb_after_init_returns_same_instance(self, temp_knowledge_dir):
        """init 后 get_kb() 返回同一实例。"""
        kb1 = init_kb(data_dir=temp_knowledge_dir)
        kb2 = get_kb()
        assert kb1 is kb2

    def test_can_search_after_init(self, temp_knowledge_dir):
        """init 后可以正常搜索。"""
        init_kb(data_dir=temp_knowledge_dir)
        kb = get_kb()
        results = kb.search("基础", top_k=3)
        assert len(results) > 0


class TestReloadKb:
    """重建索引。"""

    def test_reload_kb_returns_new_instance(self, temp_knowledge_dir):
        """reload_kb() 返回新实例。"""
        kb1 = init_kb(data_dir=temp_knowledge_dir)
        kb2 = reload_kb(data_dir=temp_knowledge_dir)
        # reload 后 get_kb() 应返回新实例
        kb3 = get_kb()
        assert kb1 is not kb3
        assert kb2 is kb3

    def test_reload_kb_clears_and_rebuilds(self, temp_knowledge_dir):
        """reload_kb() 清空旧数据并重建。"""
        init_kb(data_dir=temp_knowledge_dir)
        kb = reload_kb(data_dir=temp_knowledge_dir)
        # 应仍能正常搜索
        results = kb.search("基础", top_k=3)
        assert len(results) > 0
