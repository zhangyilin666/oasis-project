# -*- coding: utf-8 -*-
"""API 集成测试 —— TestClient + 真实 MySQL 数据库。

测试覆盖：
  - 公开端点：/health, /
  - 登录：POST /api/v1/wechat/login
  - 分析：POST /api/v1/wechat/oasis/analyze
  - 报告列表：GET /api/v1/wechat/oasis/reports
  - 报告详情：GET /api/v1/wechat/oasis/report/{id}
  - 黄历：GET /api/v1/wechat/oasis/almanac
  - 跨用户隔离、鉴权、参数校验
"""
from __future__ import annotations

import pytest


# ============================================================================
# 公开端点
# ============================================================================

class TestHealthEndpoint:
    """GET /health —— 健康检查（无需鉴权）。"""

    def test_health_returns_200(self, client):
        response = client.get("/health")
        assert response.status_code == 200
        body = response.json()
        assert body["code"] == 200
        assert body["data"]["status"] == "ok"

    def test_root_returns_200(self, client):
        response = client.get("/")
        assert response.status_code == 200
        assert response.json()["code"] == 200


# ============================================================================
# 登录端点
# ============================================================================

class TestLogin:
    """POST /api/v1/wechat/login —— 微信小程序登录。"""

    def test_login_creates_new_user(self, client, fresh_user):
        """首次登录创建新用户，返回 JWT token 和 user_id。"""
        assert fresh_user["token"]
        assert fresh_user["user_id"] > 0

    def test_login_same_code_returns_existing_user(self, client):
        """相同 code 重复登录应返回同一用户（不重复创建）。"""
        code = "test_repeated_login"
        res1 = client.post("/api/v1/wechat/login", json={"code": code})
        assert res1.status_code == 200
        uid1 = res1.json()["data"]["user_id"]

        res2 = client.post("/api/v1/wechat/login", json={"code": code})
        assert res2.status_code == 200
        uid2 = res2.json()["data"]["user_id"]

        assert uid1 == uid2, (
            f"Same code should return same user, got {uid1} vs {uid2}"
        )

    def test_login_empty_code_rejected(self, client):
        """空 code 被 Pydantic 校验拒绝。"""
        response = client.post("/api/v1/wechat/login", json={"code": ""})
        assert response.status_code == 422

    def test_login_missing_code_field(self, client):
        """缺少 code 字段返回 422。"""
        response = client.post("/api/v1/wechat/login", json={})
        assert response.status_code == 422


# ============================================================================
# 八字分析端点（核心）
# ============================================================================

class TestAnalyze:
    """POST /api/v1/wechat/oasis/analyze —— 八字命理分析。"""

    def test_analyze_returns_complete_structure(self, client, fresh_user):
        """成功分析返回完整的八字 + AI 分析结构。"""
        from tests.conftest import create_analysis
        data = create_analysis(client, fresh_user["headers"])

        # 顶层键
        for key in [
            "user_id", "report_id", "calendar_data", "ai_analysis_text",
            "workflow_status", "workflow_steps", "trace_id",
        ]:
            assert key in data, f"Missing key: {key}"

        # calendar_data 包含八字核心字段
        cd = data["calendar_data"]
        assert "full_bazi" in cd
        assert "year" in cd and "month" in cd and "day" in cd and "hour" in cd
        assert cd["year"]["gan_zhi"]  # 年柱不为空
        assert len(cd["full_bazi"].split()) == 4

        # AI 分析不为空
        assert data["ai_analysis_text"], "ai_analysis_text should not be empty"

        # workflow 状态（异步模式：status 为 "completed"）
        assert data["workflow_status"] == "completed"
        assert len(data["workflow_steps"]) > 0, "Expected at least one workflow step"
        for step in data["workflow_steps"]:
            assert "model_name" in step
            assert "status" in step
            assert "latency_ms" in step

        # trace_id 是 16 位 hex
        assert len(data["trace_id"]) == 16

    def test_analyze_without_auth_returns_401(self, client):
        """未登录请求分析返回 401。"""
        response = client.post(
            "/api/v1/wechat/oasis/analyze",
            json={
                "name": "测试用户",
                "birth_date": "1990-06-15",
                "birth_time": "08:30",
                "gender": "男",
                "location": "北京",
                "is_solar_time": True,
            },
        )
        assert response.status_code == 401

    def test_analyze_with_invalid_birth_date(self, client, fresh_user):
        """无效日期格式返回 422。"""
        response = client.post(
            "/api/v1/wechat/oasis/analyze",
            json={
                "name": "测试用户",
                "birth_date": "not-a-date",
                "birth_time": "08:30",
                "gender": "男",
                "location": "北京",
                "is_solar_time": True,
            },
            headers=fresh_user["headers"],
        )
        assert response.status_code == 422, (
            f"Expected 422, got {response.status_code}: {response.json()}"
        )

    def test_analyze_with_invalid_birth_time(self, client, fresh_user):
        """无效时间格式返回 422。"""
        response = client.post(
            "/api/v1/wechat/oasis/analyze",
            json={
                "name": "测试用户",
                "birth_date": "1990-06-15",
                "birth_time": "25:00",
                "gender": "男",
                "location": "北京",
                "is_solar_time": True,
            },
            headers=fresh_user["headers"],
        )
        assert response.status_code == 422

    def test_analyze_with_missing_field(self, client, fresh_user):
        """缺少必填字段返回 422。"""
        response = client.post(
            "/api/v1/wechat/oasis/analyze",
            json={
                "name": "测试用户",
                "birth_date": "1990-06-15",
                # missing birth_time
                "gender": "男",
                "location": "北京",
            },
            headers=fresh_user["headers"],
        )
        assert response.status_code == 422

    def test_analyze_persists_report_and_logs(self, client, fresh_user):
        """分析后数据持久化到数据库，且 report_id 可查询。"""
        from tests.conftest import create_analysis
        data = create_analysis(client, fresh_user["headers"])
        report_id = data["report_id"]
        assert report_id > 0

        # 验证可以通过 GET /report/{id} 获取到
        response = client.get(
            f"/api/v1/wechat/oasis/report/{report_id}",
            headers=fresh_user["headers"],
        )
        assert response.status_code == 200
        detail = response.json()["data"]
        assert detail["id"] == report_id
        assert detail["ai_analysis"] == data["ai_analysis_text"]

        # 验证 analysis_logs_count > 0
        assert detail["analysis_logs_count"] > 0, (
            "Expected at least one AnalysisLog entry"
        )

    def test_multiple_analyses_create_multiple_reports(self, client, fresh_user):
        """同一用户多次分析应创建多条独立报告。"""
        from tests.conftest import create_analysis
        data1 = create_analysis(client, fresh_user["headers"])
        data2 = create_analysis(
            client, fresh_user["headers"],
            overrides={"birth_date": "2000-01-01"},
        )
        assert data1["report_id"] != data2["report_id"], (
            "Each analysis should create a unique report"
        )


# ============================================================================
# 报告列表端点
# ============================================================================

class TestListReports:
    """GET /api/v1/wechat/oasis/reports —— 用户报告列表。"""

    def test_list_reports_returns_paginated(self, client, fresh_user):
        """有报告时返回分页列表。"""
        from tests.conftest import create_analysis
        create_analysis(client, fresh_user["headers"])

        response = client.get("/api/v1/wechat/oasis/reports", headers=fresh_user["headers"])
        assert response.status_code == 200
        body = response.json()
        assert body["code"] == 200
        data = body["data"]
        assert "reports" in data
        assert "total" in data
        assert data["total"] >= 1
        assert "skip" in data and "limit" in data
        # 每个列表项仅含摘要，不含完整 ai_analysis
        for rpt in data["reports"]:
            assert "id" in rpt
            assert "birth_info" in rpt
            assert "ai_analysis_preview" in rpt
            assert "created_at" in rpt
            # ai_analysis_preview 最多200字符
            assert len(rpt["ai_analysis_preview"]) <= 200

    def test_list_reports_new_user_empty(self, client, fresh_user):
        """新用户没有报告，返回空列表。"""
        response = client.get("/api/v1/wechat/oasis/reports", headers=fresh_user["headers"])
        assert response.status_code == 200
        data = response.json()["data"]
        assert data["reports"] == []
        assert data["total"] == 0

    def test_list_reports_skip_and_limit(self, client, fresh_user):
        """skip/limit 分页参数生效。"""
        from tests.conftest import create_analysis
        # 创建 3 条报告
        for i in range(3):
            create_analysis(
                client, fresh_user["headers"],
            )

        # 取 2 条
        r1 = client.get(
            "/api/v1/wechat/oasis/reports?skip=0&limit=2",
            headers=fresh_user["headers"],
        )
        assert r1.status_code == 200
        assert len(r1.json()["data"]["reports"]) == 2
        assert r1.json()["data"]["total"] == 3

        # 跳过 2 条，取剩下
        r2 = client.get(
            "/api/v1/wechat/oasis/reports?skip=2&limit=10",
            headers=fresh_user["headers"],
        )
        assert r2.status_code == 200
        assert len(r2.json()["data"]["reports"]) == 1

    def test_list_reports_without_auth_returns_401(self, client):
        """未登录请求列表返回 401。"""
        response = client.get("/api/v1/wechat/oasis/reports")
        assert response.status_code == 401

    def test_list_reports_isolated_by_user(self, client, fresh_user, other_user):
        """用户 A 看不到用户 B 的报告。"""
        from tests.conftest import create_analysis
        create_analysis(client, other_user["headers"])

        # fresh_user 应该看不到 other_user 的报告
        response = client.get("/api/v1/wechat/oasis/reports", headers=fresh_user["headers"])
        assert response.status_code == 200
        data = response.json()["data"]
        assert data["total"] == 0, (
            f"fresh_user should not see other_user's reports, got {data['total']}"
        )


# ============================================================================
# 报告详情端点
# ============================================================================

class TestReportDetail:
    """GET /api/v1/wechat/oasis/report/{report_id} —— 报告详情。"""

    def test_get_report_returns_full_detail(self, client, fresh_user):
        """成功获取报告详情（含 calendar_data + ai_analysis + analysis_logs_count）。"""
        from tests.conftest import create_analysis
        analysis_data = create_analysis(client, fresh_user["headers"])
        report_id = analysis_data["report_id"]

        response = client.get(
            f"/api/v1/wechat/oasis/report/{report_id}",
            headers=fresh_user["headers"],
        )
        assert response.status_code == 200
        detail = response.json()["data"]
        assert detail["id"] == report_id
        assert detail["user_id"] == fresh_user["user_id"]
        assert detail["birth_info"]
        assert isinstance(detail["calendar_data"], dict)
        assert detail["calendar_data"]["full_bazi"]
        assert detail["ai_analysis"]
        assert detail["analysis_logs_count"] > 0

    def test_get_report_nonexistent_returns_404(self, client, fresh_user):
        """查询不存在的报告返回 404。"""
        response = client.get(
            "/api/v1/wechat/oasis/report/999999",
            headers=fresh_user["headers"],
        )
        assert response.status_code == 404

    def test_get_report_cross_user_returns_404(self, client, fresh_user, other_user):
        """用户 A 访问用户 B 的报告返回 404（不暴露他人报告的存在）。"""
        from tests.conftest import create_analysis
        # other_user 创建报告
        analysis_data = create_analysis(client, other_user["headers"])
        report_id = analysis_data["report_id"]

        # fresh_user 尝试访问 → 404（不能证明报告存在）
        response = client.get(
            f"/api/v1/wechat/oasis/report/{report_id}",
            headers=fresh_user["headers"],
        )
        assert response.status_code == 404, (
            f"Cross-user access should return 404, got {response.status_code}"
        )

        # 但 other_user 自己能访问
        response2 = client.get(
            f"/api/v1/wechat/oasis/report/{report_id}",
            headers=other_user["headers"],
        )
        assert response2.status_code == 200

    def test_get_report_without_auth_returns_401(self, client):
        """未登录返回 401。"""
        response = client.get("/api/v1/wechat/oasis/report/1")
        assert response.status_code == 401


# ============================================================================
# 黄历端点
# ============================================================================

class TestAlmanac:
    """GET /api/v1/wechat/oasis/almanac —— 黄历宜忌查询。"""

    def test_almanac_default_today(self, client, fresh_user):
        """不传 date 参数返回今日黄历。"""
        response = client.get(
            "/api/v1/wechat/oasis/almanac",
            headers=fresh_user["headers"],
        )
        assert response.status_code == 200
        data = response.json()["data"]
        for key in [
            "solar_date", "lunar_date", "day_gan_zhi",
            "animal", "yi", "ji", "ji_shen", "xiong_sha", "chong_sheng_xiao",
        ]:
            assert key in data, f"Missing key: {key}"
        assert data["solar_date"]  # 不为空
        assert data["lunar_date"]  # 不为空
        assert data["day_gan_zhi"]  # 不为空

    def test_almanac_specific_date(self, client, fresh_user):
        """传入具体日期应返回该日黄历。"""
        response = client.get(
            "/api/v1/wechat/oasis/almanac?solar_date=2024-06-15",
            headers=fresh_user["headers"],
        )
        assert response.status_code == 200
        data = response.json()["data"]
        assert data["solar_date"] == "2024-06-15"
        assert data["day_gan_zhi"]  # 该日干支不为空

    def test_almanac_invalid_date(self, client, fresh_user):
        """无效日期格式返回 422。"""
        response = client.get(
            "/api/v1/wechat/oasis/almanac?solar_date=not-a-date",
            headers=fresh_user["headers"],
        )
        assert response.status_code == 422  # Query pattern=r"^\d{4}-\d{2}-\d{2}$"

    def test_almanac_different_dates(self, client, fresh_user):
        """不同日期的黄历内容应不同。"""
        r1 = client.get(
            "/api/v1/wechat/oasis/almanac?solar_date=2024-01-01",
            headers=fresh_user["headers"],
        )
        r2 = client.get(
            "/api/v1/wechat/oasis/almanac?solar_date=2024-06-15",
            headers=fresh_user["headers"],
        )
        assert r1.status_code == 200 and r2.status_code == 200
        d1 = r1.json()["data"]
        d2 = r2.json()["data"]
        # 不同日期=不同农历=不同的干支或生肖或宜忌
        assert (
            d1["day_gan_zhi"] != d2["day_gan_zhi"]
            or d1["lunar_date"] != d2["lunar_date"]
        ), "Different dates should produce different almanac data"

    def test_almanac_without_auth_returns_401(self, client):
        """未登录返回 401。"""
        response = client.get("/api/v1/wechat/oasis/almanac")
        assert response.status_code == 401


# ============================================================================
# 知识库浏览端点
# ============================================================================

class TestKnowledgeBase:
    """GET /api/v1/wechat/oasis/knowledge —— 古籍知识库浏览。"""

    def test_list_knowledge_returns_documents(self, client, fresh_user):
        """列出所有古籍文档。"""
        response = client.get(
            "/api/v1/wechat/oasis/knowledge",
            headers=fresh_user["headers"],
        )
        assert response.status_code == 200
        data = response.json()["data"]
        assert "total" in data
        assert "documents" in data
        assert data["total"] == len(data["documents"])
        # 至少应有加载的知识库文档
        if data["total"] > 0:
            doc = data["documents"][0]
            assert "id" in doc
            assert "title" in doc
            assert "paragraph_count" in doc

    def test_list_knowledge_without_auth_returns_401(self, client):
        """未登录返回 401。"""
        response = client.get("/api/v1/wechat/oasis/knowledge")
        assert response.status_code == 401

    def test_get_knowledge_document_exists(self, client, fresh_user):
        """获取存在的古籍文档详情。"""
        # 先列出文档，取第一个的 ID
        list_res = client.get(
            "/api/v1/wechat/oasis/knowledge",
            headers=fresh_user["headers"],
        )
        docs = list_res.json()["data"]["documents"]
        if not docs:
            import pytest
            pytest.skip("No knowledge documents loaded")
        doc_id = docs[0]["id"]

        response = client.get(
            f"/api/v1/wechat/oasis/knowledge/{doc_id}",
            headers=fresh_user["headers"],
        )
        assert response.status_code == 200
        detail = response.json()["data"]
        assert detail["id"] == doc_id
        assert "content" in detail
        assert len(detail["content"]) > 0

    def test_get_knowledge_document_not_found(self, client, fresh_user):
        """查询不存在的文档返回 404。"""
        response = client.get(
            "/api/v1/wechat/oasis/knowledge/nonexistent_doc_id",
            headers=fresh_user["headers"],
        )
        assert response.status_code == 404

    def test_get_knowledge_document_without_auth_returns_401(self, client):
        """未登录返回 401。"""
        response = client.get("/api/v1/wechat/oasis/knowledge/shishen_detail")
        assert response.status_code == 401


# ============================================================================
# Token 刷新端点
# ============================================================================

class TestRefresh:
    """POST /api/v1/wechat/refresh —— JWT Token 宽限期刷新。"""

    def test_refresh_with_valid_token(self, client, fresh_user):
        """有效 token 刷新成功，返回有效 token。"""
        response = client.post(
            "/api/v1/wechat/refresh",
            headers=fresh_user["headers"],
        )
        assert response.status_code == 200
        data = response.json()["data"]
        assert data["token"]
        assert data["user_id"] == fresh_user["user_id"]

    def test_refresh_new_token_works(self, client, fresh_user):
        """刷新后的 token 可用于访问受保护端点。"""
        response = client.post(
            "/api/v1/wechat/refresh",
            headers=fresh_user["headers"],
        )
        new_token = response.json()["data"]["token"]

        # 用新 token 查报告列表
        list_res = client.get(
            "/api/v1/wechat/oasis/reports",
            headers={"Authorization": f"Bearer {new_token}"},
        )
        assert list_res.status_code == 200

    def test_refresh_without_token_returns_401(self, client):
        """无 token 返回 401。"""
        response = client.post("/api/v1/wechat/refresh")
        assert response.status_code == 401

    def test_refresh_with_invalid_token_returns_401(self, client):
        """被篡改的 token 返回 401。"""
        response = client.post(
            "/api/v1/wechat/refresh",
            headers={"Authorization": "Bearer invalid.token.here"},
        )
        assert response.status_code == 401

    def test_refresh_token_refreshes(self, client, fresh_user):
        """多次刷新始终成功（幂等性）。"""
        for _ in range(3):
            response = client.post(
                "/api/v1/wechat/refresh",
                headers=fresh_user["headers"],
            )
            assert response.status_code == 200
            # 用最新 token 继续
            fresh_user["headers"] = {
                "Authorization": f"Bearer {response.json()['data']['token']}"
            }


# ============================================================================
# 跨场景集成测试
# ============================================================================

class TestFullWorkflow:
    """端到端业务流程：登录 → 分析 → 查报告列表 → 看详情 → 查黄历。"""

    def test_full_user_journey(self, client):
        """模拟用户完整使用路径。"""
        import time

        # 1. 登录
        login_res = client.post(
            "/api/v1/wechat/login",
            json={"code": "e2e_full_workflow_test"},
        )
        assert login_res.status_code == 200
        token = login_res.json()["data"]["token"]
        headers = {"Authorization": f"Bearer {token}"}
        user_id = login_res.json()["data"]["user_id"]

        # Track for cleanup
        from tests.conftest import _TEST_USER_IDS
        _TEST_USER_IDS.append(user_id)

        # 2. 分析（异步提交）
        analyze_res = client.post(
            "/api/v1/wechat/oasis/analyze",
            json={
                "name": "端到端测试",
                "birth_date": "1990-06-15",
                "birth_time": "08:30",
                "gender": "男",
                "location": "北京",
                "is_solar_time": True,
            },
            headers=headers,
        )
        assert analyze_res.status_code == 200
        analysis = analyze_res.json()["data"]
        report_id = analysis["report_id"]
        assert analysis["status"] == "pending"
        from tests.conftest import _TEST_REPORT_IDS
        _TEST_REPORT_IDS.append(report_id)

        # 2b. 轮询等待分析完成
        for _ in range(50):
            detail_res = client.get(
                f"/api/v1/wechat/oasis/report/{report_id}",
                headers=headers,
            )
            assert detail_res.status_code == 200
            detail = detail_res.json()["data"]
            if detail.get("status") == "completed":
                break
            if detail.get("status") == "failed":
                raise AssertionError(
                    f"Analysis failed: {detail.get('error_message')}"
                )
            time.sleep(0.1)
        else:
            raise AssertionError("Analysis timed out")

        # 3. 报告列表中有这条
        list_res = client.get("/api/v1/wechat/oasis/reports", headers=headers)
        assert list_res.status_code == 200
        report_ids = [r["id"] for r in list_res.json()["data"]["reports"]]
        assert report_id in report_ids

        # 4. 报告详情数据完整
        assert detail["ai_analysis"]
        assert detail["calendar_data"]["full_bazi"]

        # 5. 黄历查询正常
        almanac_res = client.get("/api/v1/wechat/oasis/almanac", headers=headers)
        assert almanac_res.status_code == 200
        assert almanac_res.json()["data"]["animal"] != ""
