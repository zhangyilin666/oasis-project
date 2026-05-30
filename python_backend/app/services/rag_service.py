# -*- coding: utf-8 -*-
"""
RAG 知识库检索服务。

传统文化典籍检索增强生成（Retrieval-Augmented Generation）。

当前阶段（Phase 3）：
  - 文件系统加载 TXT/MD 文档
  - 关键词 + 段落级检索引擎
  - 预留向量数据库接口（ChromaDB / FAISS）

后续升级只需实现 VectorRetriever 接口即可切换。

用法::

    from app.services.rag_service import KnowledgeBase, get_kb

    kb = get_kb()
    results = kb.search("五行 金木水火土", top_k=5)
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional, Protocol

from app.core.logger import logger


# ---------------------------------------------------------------------------
# 数据模型
# ---------------------------------------------------------------------------

@dataclass
class Document:
    """知识库文档。"""

    id: str
    title: str
    content: str
    source_file: str = ""
    metadata: dict = field(default_factory=dict)


@dataclass
class SearchResult:
    """单条检索结果。"""

    document_id: str
    title: str
    content_snippet: str  # 匹配段落的前 N 字符
    score: float  # 0.0 ~ 1.0 相关性分数
    metadata: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        return {
            "document_id": self.document_id,
            "title": self.title,
            "content_snippet": self.content_snippet,
            "score": self.score,
            "metadata": self.metadata,
        }


# ---------------------------------------------------------------------------
# 检索器接口（策略模式）
# ---------------------------------------------------------------------------

class Retriever(Protocol):
    """检索器协议 — 后续可替换为向量检索实现。"""

    def search(self, query: str, top_k: int = 5) -> list[SearchResult]:
        ...

    def add_document(self, doc: Document) -> None:
        ...

    def count(self) -> int:
        ...


# ---------------------------------------------------------------------------
# 关键词检索引擎（当前实现）
# ---------------------------------------------------------------------------

class KeywordRetriever:
    """
    基于关键词匹配 + 段落拆分的检索引擎。

    后续升级为 VectorRetriever 时保持相同接口。
    """

    def __init__(self):
        self._documents: list[Document] = []
        self._paragraphs: list[tuple[Document, str, int]] = []
        #                                   ^doc   ^text ^para_index

    def add_document(self, doc: Document) -> None:
        """
        添加文档并按段落切分建立索引。

        段落划分规则：空行 / 两个以上换行符。
        """
        self._documents.append(doc)

        # 按空行切分段落
        raw_paragraphs = re.split(r"\n\s*\n", doc.content)
        for idx, para in enumerate(raw_paragraphs):
            cleaned = para.strip()
            if len(cleaned) < 4:  # 跳过过短段落（空行/标题残留）
                continue
            self._paragraphs.append((doc, cleaned, idx))

        logger.info(
            "Document '%s' indexed: %d paragraphs",
            doc.title,
            len(raw_paragraphs),
        )

    def search(self, query: str, top_k: int = 5) -> list[SearchResult]:
        """
        关键词检索。

        评分策略：
          - 精确关键词命中 +0.4/次
          - 单字命中 +0.1/次
          - 标题命中 ×1.5 加权
          - 分数归一化到 0~1

        Args:
            query: 搜索查询文本。
            top_k: 返回前 K 条结果。

        Returns:
            按相关性降序排列的检索结果列表。
        """
        if not self._paragraphs:
            logger.warning("Knowledge base is empty, no documents indexed")
            return []

        # 分词（简单按字/词切分，后续可接 jieba）
        keywords = self._tokenize(query)

        scored: list[tuple[float, Document, str]] = []
        for doc, para_text, _ in self._paragraphs:
            score = self._compute_score(keywords, para_text, doc.title)
            if score > 0:
                scored.append((score, doc, para_text))

        # 按分数降序排列
        scored.sort(key=lambda x: x[0], reverse=True)

        # 归一化（0~1）
        if scored:
            max_score = scored[0][0]
            if max_score > 0:
                scored = [(s / max_score, d, p) for s, d, p in scored]

        results = []
        for score, doc, para_text in scored[:top_k]:
            results.append(SearchResult(
                document_id=doc.id,
                title=doc.title,
                content_snippet=para_text[:300],
                score=round(score, 4),
                metadata={"source_file": doc.source_file},
            ))

        logger.debug(
            "Search '%s': %d results (top_k=%d)",
            query[:50],
            len(results),
            top_k,
        )
        return results

    def count(self) -> int:
        """已索引文档数。"""
        return len(self._documents)

    @staticmethod
    def _tokenize(text: str) -> list[str]:
        """
        简单分词：按常见标点和空格切分，保留 >=2 字的词。

        后续升级为 jieba 分词。
        """
        raw = re.split(r"[，。、；：？！\s,.!?;:]+", text)
        tokens = [t.strip() for t in raw if len(t.strip()) >= 2]
        # 补充单字关键词（如五行：金木水火土）
        single_chars = re.findall(r"[一-鿿]", text)
        tokens.extend(single_chars)
        return tokens

    @staticmethod
    def _compute_score(keywords: list[str], para_text: str, title: str) -> float:
        """计算单段落与查询的相关性分数。"""
        score = 0.0

        for kw in keywords:
            count = para_text.count(kw)
            if len(kw) >= 2:
                score += count * 0.4
            else:
                score += count * 0.1

        # 标题命中加权
        title_hits = sum(1 for kw in keywords if kw in title)
        score *= 1.0 + title_hits * 0.5

        return score


# ---------------------------------------------------------------------------
# 知识库门面
# ---------------------------------------------------------------------------

class KnowledgeBase:
    """
    知识库门面类。

    封装文档加载、索引构建和检索的完整流程。

    用法::

        kb = KnowledgeBase(data_dir=Path("data_center/knowledge"))
        kb.load_all()
        results = kb.search("八字 五行", top_k=3)
    """

    def __init__(
        self,
        data_dir: Optional[Path] = None,
        retriever: Optional[Retriever] = None,
    ):
        """
        Args:
            data_dir: 知识库文档目录，默认为项目根目录下的 data_center/knowledge。
            retriever: 检索器实现，默认使用 KeywordRetriever。
        """
        if data_dir is None:
            # 从 rag_service.py 向上找项目根目录
            data_dir = Path(__file__).resolve().parents[3] / "data_center" / "knowledge"
        self.data_dir = Path(data_dir)
        self.retriever: Retriever = retriever or KeywordRetriever()

    def load_all(self) -> int:
        """
        加载 data_dir 下所有 TXT/MD 文档并索引。

        Returns:
            加载的文档总数。
        """
        self.data_dir.mkdir(parents=True, exist_ok=True)

        loaded = 0
        for ext in ("*.txt", "*.md"):
            for file_path in self.data_dir.glob(ext):
                try:
                    doc = self._load_file(file_path)
                    self.retriever.add_document(doc)
                    loaded += 1
                except Exception:
                    logger.exception("Failed to load document: %s", file_path)

        logger.info("KnowledgeBase loaded: %d documents from %s", loaded, self.data_dir)
        return loaded

    def search(self, query: str, top_k: int = 5) -> list[SearchResult]:
        """检索知识库。"""
        return self.retriever.search(query, top_k)

    def add_document(self, doc: Document) -> None:
        """手动添加文档。"""
        self.retriever.add_document(doc)

    @property
    def document_count(self) -> int:
        return self.retriever.count()

    @staticmethod
    def _load_file(file_path: Path) -> Document:
        """加载单个文本文件为 Document。"""
        content = file_path.read_text(encoding="utf-8")
        doc_id = file_path.stem
        return Document(
            id=doc_id,
            title=file_path.stem.replace("_", " "),
            content=content,
            source_file=str(file_path),
        )


# ---------------------------------------------------------------------------
# 单例（应用级）
# ---------------------------------------------------------------------------

_kb_instance: Optional[KnowledgeBase] = None


def get_kb(data_dir: Optional[Path] = None) -> KnowledgeBase:
    """
    获取知识库单例。

    首次调用时自动加载 data_dir 下所有文档。
    """
    global _kb_instance
    if _kb_instance is None:
        _kb_instance = KnowledgeBase(data_dir=data_dir)
        _kb_instance.load_all()
    return _kb_instance


def reload_kb(data_dir: Optional[Path] = None) -> KnowledgeBase:
    """
    强制重建知识库索引（文档更新后调用）。
    """
    global _kb_instance
    _kb_instance = KnowledgeBase(data_dir=data_dir)
    _kb_instance.load_all()
    return _kb_instance
