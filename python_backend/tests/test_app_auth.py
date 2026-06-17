# -*- coding: utf-8 -*-
"""App 匿名登录 + Token 刷新 API 集成测试。

测试覆盖：
  - POST /api/v1/app/anonymous-login  — 设备匿名登录
  - POST /api/v1/app/refresh          — Token 刷新
  - App 用户访问业务端点（/api/v1/app/oasis/*）
  - 跨用户隔离
"""
from __future__ import annotations

import uuid

import pytest
from fastapi.testclient import TestClient


# ============================================================================
# Helpers
# ============================================================================

_TEST_USER_IDS: list[int] = []


def _random_device_id() -> str:
    """生成随机设备 ID。"""
    return str(uuid.uuid4())


def _do_anonymous_login(client: TestClient, device_id: str | None = None) -> dict:
    """匿名登录 → 返回 token 和 user_id。"""
    if device_id is None:
        device_id = _random_device_id()

    res = client.post("/api/v1/app/anonymous-login", json={"device_id": device_id})
    assert res.status_code == 200, f"Anonymous login failed: {res.json()}"
    data = res.json()["data"]
    assert "token" in data
    assert data["user_id"] > 0

    _TEST_USER_IDS.append(data["user_id"])

    return {
        "token": data["token"],
        "user_id": data["user_id"],
        "device_id": device_id,
        "headers": {"Authorization": f"Bearer {data['token']}"},
    }


# ============================================================================
# 匿名登录端点
# ============================================================================


class TestAnonymousLogin:
    """POST /api/v1/app/anonymous-login"""

    def test_login_creates_new_user(self, client):
        """首次使用设备 ID → 创建新用户并返回 JWT。"""
        user = _do_anonymous_login(client)
        assert user["token"]
        assert user["user_id"] > 0

    def test_login_same_device_returns_existing_user(self, client):
        """相同设备 ID 重复登录返回同一用户。"""
        device_id = _random_device_id()
        user1 = _do_anonymous_login(client, device_id)
        user2 = _do_anonymous_login(client, device_id)
        assert user2["user_id"] == user1["user_id"], (
            f"Same device_id should return same user: {user1['user_id']} vs {user2['user_id']}"
        )

    def test_login_different_devices_create_different_users(self, client):
        """不同设备 ID 创建不同用户。"""
        user_a = _do_anonymous_login(client)
        user_b = _do_anonymous_login(client)
        assert user_a["user_id"] != user_b["user_id"], (
            "Different devices should have different user IDs"
        )

    def test_login_empty_device_id_rejected(self, client):
        """空 device_id 被拒绝。"""
        res = client.post("/api/v1/app/anonymous-login", json={"device_id": ""})
        assert res.status_code == 422

    def test_login_missing_device_id_rejected(self, client):
        """缺少 device_id 字段被拒绝。"""
        res = client.post("/api/v1/app/anonymous-login", json={})
        assert res.status_code == 422

    def test_login_short_device_id_rejected(self, client):
        """device_id 过短被拒绝。"""
        res = client.post("/api/v1/app/anonymous-login", json={"device_id": "abc"})
        assert res.status_code == 422


# ============================================================================
# Token 刷新端点
# ============================================================================


class TestAppRefresh:
    """POST /api/v1/app/refresh"""

    def test_refresh_returns_new_token(self, client):
        """正常刷新返回有效 token 和相同 user_id。"""
        user = _do_anonymous_login(client)

        res = client.post(
            "/api/v1/app/refresh",
            headers=user["headers"],
        )
        assert res.status_code == 200
        data = res.json()["data"]
        assert data["token"]  # 返回了 token
        assert data["user_id"] == user["user_id"]

    def test_refresh_no_token_rejected(self, client):
        """无 token 刷新被拒绝。"""
        res = client.post("/api/v1/app/refresh")
        assert res.status_code == 401

    def test_refresh_invalid_token_rejected(self, client):
        """假 token 刷新被拒绝。"""
        res = client.post(
            "/api/v1/app/refresh",
            headers={"Authorization": "Bearer fake_token"},
        )
        assert res.status_code == 401


# ============================================================================
# 匿名用户访问业务端点
# ============================================================================


class TestAppUserBusinessEndpoints:
    """匿名登录用户使用 App 路径访问业务 API。"""

    @pytest.fixture
    def device_user(self, client):
        """创建一个匿名登录的测试用户。"""
        return _do_anonymous_login(client)

    def test_almanac_via_app_path(self, client, device_user):
        """匿名用户可访问 /api/v1/app/oasis/almanac。"""
        res = client.get(
            "/api/v1/app/oasis/almanac",
            headers=device_user["headers"],
        )
        assert res.status_code == 200
        data = res.json()["data"]
        assert "solar_date" in data or "lunar_date" in data

    def test_reports_via_app_path(self, client, device_user):
        """匿名用户可访问 /api/v1/app/oasis/reports。"""
        res = client.get(
            "/api/v1/app/oasis/reports",
            headers=device_user["headers"],
        )
        assert res.status_code == 200
        data = res.json()["data"]
        assert "reports" in data
        assert "total" in data

    def test_knowledge_via_app_path(self, client, device_user):
        """匿名用户可访问 /api/v1/app/oasis/knowledge。"""
        res = client.get(
            "/api/v1/app/oasis/knowledge",
            headers=device_user["headers"],
        )
        assert res.status_code == 200
        data = res.json()["data"]
        assert "documents" in data

    def test_daily_fortune_via_app_path(self, client, device_user):
        """匿名用户可访问每日运势（无报告时返回 400）。"""
        res = client.get(
            "/api/v1/app/oasis/daily-fortune",
            headers=device_user["headers"],
        )
        assert res.status_code in (200, 400)

    def test_analyze_via_app_path(self, client, device_user):
        """匿名用户可提交八字分析（使用 App 路径）。"""
        payload = {
            "name": "测试用户",
            "birth_date": "1990-06-15",
            "birth_time": "08:30",
            "gender": "男",
            "location": "杭州",
            "is_solar_time": True,
        }
        res = client.post(
            "/api/v1/app/oasis/analyze",
            json=payload,
            headers=device_user["headers"],
        )
        assert res.status_code == 200
        data = res.json()["data"]
        assert data["report_id"] > 0
        assert data["status"] == "pending"

    def test_analyze_no_auth_rejected(self, client):
        """无 token 访问业务端点被拒绝。"""
        payload = {
            "name": "测试",
            "birth_date": "1990-01-01",
            "birth_time": "12:00",
            "gender": "男",
            "location": "北京",
        }
        res = client.post("/api/v1/app/oasis/analyze", json=payload)
        assert res.status_code == 401


# ============================================================================
# 跨用户隔离
# ============================================================================


class TestCrossUserIsolationApp:
    """匿名登录用户的跨用户隔离测试。"""

    def test_cannot_view_other_user_report(self, client):
        """用户 A 不能查看用户 B 的报告。"""
        user_a = _do_anonymous_login(client)
        user_b = _do_anonymous_login(client)

        # 用户 B 先创建一个报告
        payload = {
            "name": "用户B",
            "birth_date": "1990-01-01",
            "birth_time": "12:00",
            "gender": "女",
            "location": "上海",
        }
        res = client.post(
            "/api/v1/app/oasis/analyze",
            json=payload,
            headers=user_b["headers"],
        )
        assert res.status_code == 200
        report_id = res.json()["data"]["report_id"]

        # 用户 A 尝试查看 → 404
        res = client.get(
            f"/api/v1/app/oasis/report/{report_id}",
            headers=user_a["headers"],
        )
        assert res.status_code == 404
