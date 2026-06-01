# -*- coding: utf-8 -*-
"""pytest 共享 fixtures。"""
from __future__ import annotations

import uuid
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.services.rag_service import Document, KeywordRetriever, KnowledgeBase


# ---------------------------------------------------------------------------
# 知识库测试 fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def sample_document() -> Document:
    """单个五行基础知识文档。"""
    return Document(
        id="wu_xing_basics",
        title="wu xing basics",
        content=(
            "五行基础\n\n"
            "五行是中国古代哲学的核心概念，指金、木、水、火、土五种基本物质。\n\n"
            "一、五行相生\n"
            "金生水，水生木，木生火，火生土，土生金。\n\n"
            "二、五行相克\n"
            "金克木，木克土，土克水，水克火，火克金。"
        ),
        source_file="data_center/knowledge/wu_xing_basics.txt",
    )


@pytest.fixture
def sample_document_2() -> Document:
    """第二个测试文档 — 八字基础。"""
    return Document(
        id="bazi_basics",
        title="bazi basics",
        content=(
            "八字基础\n\n"
            "八字，又称四柱，由年柱、月柱、日柱、时柱组成。\n\n"
            "每柱由一个天干和一个地支组成，共八个字。\n\n"
            "天干有十个：甲乙丙丁戊己庚辛壬癸。\n"
            "地支有十二个：子丑寅卯辰巳午未申酉戌亥。"
        ),
        source_file="data_center/knowledge/bazi_basics.txt",
    )


@pytest.fixture
def empty_retriever() -> KeywordRetriever:
    """空检索引擎。"""
    return KeywordRetriever()


@pytest.fixture
def retriever_with_docs(sample_document, sample_document_2) -> KeywordRetriever:
    """包含两个文档的检索引擎。"""
    r = KeywordRetriever()
    r.add_document(sample_document)
    r.add_document(sample_document_2)
    return r


@pytest.fixture
def temp_knowledge_dir(tmp_path) -> Path:
    """临时知识库目录，含一个 txt 和一个 md 文件。"""
    (tmp_path / "basics.txt").write_text(
        "测试基础\n\n"
        "金木水火土是五行元素。\n\n"
        "五行相生：金生水，水生木，木生火，火生土，土生金。",
        encoding="utf-8",
    )
    (tmp_path / "advanced.md").write_text(
        "# 进阶\n\n"
        "八字四柱分析需要综合考虑五行生克关系。\n\n"
        "命宫与身宫是辅助判断的重要参考。",
        encoding="utf-8",
    )
    return tmp_path


# ---------------------------------------------------------------------------
# API 集成测试 fixtures
# ---------------------------------------------------------------------------

_TEST_USER_IDS: list[int] = []
_TEST_REPORT_IDS: list[int] = []


def _cleanup_test_data():
    """删除集成测试期间创建的用户和报告。"""
    from app.db.database import SessionLocal
    from app.models.report_model import Report
    from app.models.user_model import User

    db = SessionLocal()
    try:
        if _TEST_REPORT_IDS:
            db.query(Report).filter(Report.id.in_(_TEST_REPORT_IDS)).delete(
                synchronize_session=False
            )
            _TEST_REPORT_IDS.clear()
        if _TEST_USER_IDS:
            db.query(User).filter(User.id.in_(_TEST_USER_IDS)).delete(
                synchronize_session=False
            )
            _TEST_USER_IDS.clear()
        db.commit()
    finally:
        db.close()


@pytest.fixture(scope="session")
def client():
    """FastAPI TestClient（session 级，复用）。"""
    from app.main import app

    with TestClient(app) as c:
        yield c

    # session 结束后清理所有测试数据
    _cleanup_test_data()


@pytest.fixture
def fresh_user(client):
    """
    为每个测试用例创建一个全新的测试用户。

    通过 /api/v1/wechat/login 获取 token，返回:
        {"token": str, "user_id": int, "headers": dict}
    """
    unique_code = f"test_code_{uuid.uuid4().hex[:8]}"
    response = client.post("/api/v1/wechat/login", json={"code": unique_code})
    assert response.status_code == 200, f"Login failed: {response.json()}"
    data = response.json()["data"]
    user_id = data["user_id"]
    token = data["token"]

    _TEST_USER_IDS.append(user_id)

    yield {
        "token": token,
        "user_id": user_id,
        "headers": {"Authorization": f"Bearer {token}"},
    }


@pytest.fixture
def other_user(client):
    """
    第二个测试用户 —— 用于测试跨用户隔离场景。

    比如：用户 A 不能查看用户 B 的报告。
    """
    unique_code = f"test_code_other_{uuid.uuid4().hex[:8]}"
    response = client.post("/api/v1/wechat/login", json={"code": unique_code})
    assert response.status_code == 200, f"Login failed: {response.json()}"
    data = response.json()["data"]
    user_id = data["user_id"]
    token = data["token"]

    _TEST_USER_IDS.append(user_id)

    yield {
        "token": token,
        "user_id": user_id,
        "headers": {"Authorization": f"Bearer {token}"},
    }


def create_analysis(client, headers: dict, overrides: dict | None = None) -> dict:
    """
    发起一次八字分析请求，返回响应 JSON 的 data 字段。

    同时追踪产生的 report_id 便于最终清理。
    """
    payload: dict = {
        "name": "测试用户",
        "birth_date": "1990-06-15",
        "birth_time": "08:30",
        "gender": "男",
        "location": "北京",
        "is_solar_time": True,
    }
    if overrides:
        payload.update(overrides)
    response = client.post(
        "/api/v1/wechat/oasis/analyze",
        json=payload,
        headers=headers,
    )
    assert response.status_code == 200, (
        f"Analysis failed: {response.status_code} {response.json()}"
    )
    result = response.json()
    data = result.get("data", {})
    report_id = data.get("report_id")
    if report_id is not None:
        _TEST_REPORT_IDS.append(report_id)
    return data
