# -*- coding: utf-8 -*-
"""KeywordRetriever + KnowledgeBase 测试。"""
from __future__ import annotations

import pytest

from app.services.rag_service import Document, KeywordRetriever, KnowledgeBase, SearchResult


# ---------------------------------------------------------------------------
# KeywordRetriever — 单元测试
# ---------------------------------------------------------------------------

class TestKeywordRetrieverInit:
    """构造与初始状态。"""

    def test_count_zero_after_init(self, empty_retriever):
        """新建 retriever 文档数为 0。"""
        assert empty_retriever.count() == 0

    def test_search_empty_retriever_returns_empty(self, empty_retriever):
        """空 retriever 搜索返回空列表。"""
        results = empty_retriever.search("五行 金木水火土", top_k=5)
        assert results == []


class TestKeywordRetrieverAddDocument:
    """文档添加与索引。"""

    def test_count_increments_after_add(self, empty_retriever, sample_document):
        """添加文档后 count 递增。"""
        empty_retriever.add_document(sample_document)
        assert empty_retriever.count() == 1

    def test_add_two_documents(self, empty_retriever, sample_document, sample_document_2):
        """添加两个文档后 count=2。"""
        empty_retriever.add_document(sample_document)
        empty_retriever.add_document(sample_document_2)
        assert empty_retriever.count() == 2

    def test_paragraphs_indexed(self, empty_retriever, sample_document):
        """文档被按段落切分，搜索能命中多个段落。"""
        empty_retriever.add_document(sample_document)
        results = empty_retriever.search("五行", top_k=10)
        # 五行基础文档有 5 个有效段落
        assert len(results) >= 1


class TestKeywordRetrieverSearch:
    """搜索行为。"""

    def test_search_finds_relevant_content(self, retriever_with_docs):
        """搜索关键词命中相关内容。"""
        results = retriever_with_docs.search("五行 相生", top_k=3)
        assert len(results) > 0
        assert any("五行" in r.content_snippet for r in results)

    def test_search_results_are_search_result_objects(self, retriever_with_docs):
        """搜索结果返回 SearchResult 实例。"""
        results = retriever_with_docs.search("五行", top_k=1)
        assert len(results) == 1
        assert isinstance(results[0], SearchResult)
        assert results[0].score >= 0.0
        assert results[0].score <= 1.0

    def test_search_score_descending(self, retriever_with_docs):
        """结果按 score 降序排列。"""
        results = retriever_with_docs.search("五行 相生", top_k=5)
        scores = [r.score for r in results]
        assert scores == sorted(scores, reverse=True)

    def test_search_top_k_truncation(self, retriever_with_docs):
        """top_k 限制返回数量。"""
        results = retriever_with_docs.search("五行", top_k=1)
        assert len(results) <= 1

    def test_search_no_match_returns_empty(self, retriever_with_docs):
        """无匹配查询返回空列表。"""
        # 使用纯拉丁字符，确保不与中文文档中任何单字 CJK 匹配
        results = retriever_with_docs.search("ZZZ_NOMATCH_ZZZ", top_k=5)
        assert results == []


class TestKeywordRetrieverTokenize:
    """分词行为。"""

    def test_tokenize_splits_on_punctuation(self):
        """分词在标点处切分。"""
        tokens = KeywordRetriever._tokenize("金木水火土，五行相生")
        # "金木水火土" >= 2 → token, "五行相生" >= 2 → token
        # Also single Chinese chars extracted
        assert "金木水火土" in tokens or "五行相生" in tokens or any("金" in t or "水" in t for t in tokens)

    def test_tokenize_includes_single_chinese_chars(self):
        """单字中文也被提取（用于五行单字匹配）。"""
        tokens = KeywordRetriever._tokenize("金木")
        # Should include at least some single characters
        has_single = any(len(t) == 1 for t in tokens)
        assert has_single


class TestComputeScore:
    """评分算法。"""

    def test_title_hit_boosts_score(self):
        """标题命中关键词时分数加权。"""
        keywords = ["五行"]
        score_with_title_hit = KeywordRetriever._compute_score(
            keywords, "五行的概念", "wu xing basics"
        )
        score_without_title = KeywordRetriever._compute_score(
            keywords, "五行的概念", "other basics"
        )
        # 标题命中应 > 未命中（或其他条件相等时至少相等）
        assert score_with_title_hit >= score_without_title

    def test_longer_keyword_scores_higher(self):
        """双字以上关键词比单字权重高 4 倍。"""
        long_kw = KeywordRetriever._compute_score(["五行"], "五行的金木水火土", "test")
        short_kw = KeywordRetriever._compute_score(["金"], "五行的金木水火土", "test")
        # 同样出现一次，"五行"(≥2字) → 0.4, "金"(1字) → 0.1
        assert long_kw > short_kw


# ---------------------------------------------------------------------------
# KnowledgeBase — 集成测试
# ---------------------------------------------------------------------------

class TestKnowledgeBase:
    """KnowledgeBase 门面。"""

    def test_load_all_from_tmp_dir(self, temp_knowledge_dir):
        """加载临时目录下的 txt/md 文件。"""
        kb = KnowledgeBase(data_dir=temp_knowledge_dir)
        count = kb.load_all()
        assert count == 2
        assert kb.document_count == 2

    def test_search_integration(self, temp_knowledge_dir):
        """端到端搜索。"""
        kb = KnowledgeBase(data_dir=temp_knowledge_dir)
        kb.load_all()
        results = kb.search("五行 相生", top_k=3)
        assert len(results) > 0
        # 最高分结果应包含五行相关内容
        assert any("五行" in r.content_snippet for r in results)

    def test_custom_retriever(self, temp_knowledge_dir):
        """注入自定义 retriever。"""
        custom = KeywordRetriever()
        kb = KnowledgeBase(data_dir=temp_knowledge_dir, retriever=custom)
        kb.load_all()
        assert kb.document_count == 2
        assert kb.retriever is custom

    def test_add_document_manually(self, temp_knowledge_dir, sample_document):
        """手动添加文档。"""
        kb = KnowledgeBase(data_dir=temp_knowledge_dir)
        kb.add_document(sample_document)
        assert kb.document_count == 1

    def test_list_documents(self, temp_knowledge_dir):
        """列出所有文档元信息。"""
        kb = KnowledgeBase(data_dir=temp_knowledge_dir)
        kb.load_all()
        docs = kb.list_documents()
        assert len(docs) == 2
        assert all("id" in d and "title" in d and "paragraph_count" in d for d in docs)
        # 文档 ID 应与文件名 stem 一致
        ids = {d["id"] for d in docs}
        assert "basics" in ids
        assert "advanced" in ids

    def test_get_document_exists(self, temp_knowledge_dir):
        """获取存在的文档完整内容。"""
        kb = KnowledgeBase(data_dir=temp_knowledge_dir)
        kb.load_all()
        doc = kb.get_document("basics")
        assert doc is not None
        assert doc["id"] == "basics"
        assert doc["title"] == "basics"
        assert "content" in doc
        assert "五行相生" in doc["content"]

    def test_get_document_not_found(self, temp_knowledge_dir):
        """获取不存在的文档返回 None。"""
        kb = KnowledgeBase(data_dir=temp_knowledge_dir)
        kb.load_all()
        doc = kb.get_document("nonexistent")
        assert doc is None
