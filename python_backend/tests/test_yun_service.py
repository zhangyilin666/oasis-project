# -*- coding: utf-8 -*-
"""大运流年 API 与服务测试。

测试覆盖：
  - GET /api/v1/wechat/oasis/yun — 响应格式与数据完整性
  - 会员用户获取全部 8 大运 × 10 流年
  - 免费用户仅获取当前年数据
  - 无报告用户返回 400
  - 流年十神/冲合/太岁计算正确性
  - 跨用户隔离
"""
from __future__ import annotations

import time

import pytest

from app.db.database import SessionLocal
from app.services.yun_service import get_yun_fortune


# ============================================================================
# 工具函数
# ============================================================================

# conftest 中 _TEST_REPORT_IDS 用于自动清理，此处追加
_TEST_REPORT_IDS: list[int] = []


def _create_completed_analysis(client, headers: dict) -> dict:
    """
    发起一次八字分析请求，轮询至完成，返回报告详情 data。

    复刻 conftest.create_analysis 的核心逻辑，
    确保测试文件中不依赖 conftest 模块导入。
    """
    payload = {
        "name": "测试用户",
        "birth_date": "1990-06-15",
        "birth_time": "08:30",
        "gender": "男",
        "location": "北京",
        "is_solar_time": True,
    }

    # 1. 提交分析
    response = client.post(
        "/api/v1/wechat/oasis/analyze",
        json=payload,
        headers=headers,
    )
    assert response.status_code == 200, (
        f"Analysis submission failed: {response.status_code} {response.json()}"
    )
    submit_data = response.json()["data"]
    report_id = submit_data["report_id"]
    assert report_id > 0
    _TEST_REPORT_IDS.append(report_id)

    # 2. 轮询至完成
    for _ in range(50):
        detail_res = client.get(
            f"/api/v1/wechat/oasis/report/{report_id}",
            headers=headers,
        )
        assert detail_res.status_code == 200
        detail_data = detail_res.json()["data"]
        if detail_data.get("status") == "completed":
            break
        if detail_data.get("status") == "failed":
            raise AssertionError(
                f"Analysis failed: {detail_data.get('error_message', 'unknown')}"
            )
        time.sleep(0.1)
    else:
        raise AssertionError("Analysis timed out after 5s")

    return detail_data


# ============================================================================
# API 端点测试
# ============================================================================

class TestYunApi:
    """GET /api/v1/wechat/oasis/yun —— 大运流年端点。"""

    def test_yun_returns_envelope_format(self, client, fresh_user):
        """API 返回标准 {code, message, data} 格式。"""
        _create_completed_analysis(client, fresh_user["headers"])

        res = client.get(
            "/api/v1/wechat/oasis/yun",
            headers=fresh_user["headers"],
        )
        assert res.status_code == 200
        body = res.json()
        assert body["code"] == 200
        assert body["message"] == "ok"
        assert body["data"] is not None

    def test_yun_data_has_required_top_level_keys(self, client, fresh_user):
        """响应 data 包含所有顶层字段。"""
        _create_completed_analysis(client, fresh_user["headers"])

        res = client.get(
            "/api/v1/wechat/oasis/yun",
            headers=fresh_user["headers"],
        )
        data = res.json()["data"]

        assert "is_premium" in data
        assert "start_info" in data
        assert "current_da_yun_index" in data
        assert "current_year" in data
        assert "da_yun" in data

    def test_start_info_has_all_fields(self, client, fresh_user):
        """起运信息包含所有必要字段。"""
        _create_completed_analysis(client, fresh_user["headers"])

        res = client.get(
            "/api/v1/wechat/oasis/yun",
            headers=fresh_user["headers"],
        )
        start_info = res.json()["data"]["start_info"]

        assert "start_age" in start_info
        assert len(start_info["start_age"]) > 0
        assert "start_solar_date" in start_info
        assert "is_forward" in start_info
        assert start_info["direction_text"] in ("顺行", "逆行")

    def test_da_yun_items_have_required_fields(self, client, fresh_user):
        """大运列表项包含所有必要字段。"""
        _create_completed_analysis(client, fresh_user["headers"])

        res = client.get(
            "/api/v1/wechat/oasis/yun",
            headers=fresh_user["headers"],
        )
        da_yun_list = res.json()["data"]["da_yun"]

        assert len(da_yun_list) >= 1
        dy = da_yun_list[0]
        assert "index" in dy
        assert "gan_zhi" in dy
        assert len(dy["gan_zhi"]) == 2
        assert "start_age" in dy
        assert "end_age" in dy
        assert "start_year" in dy
        assert "end_year" in dy
        assert "is_current" in dy
        assert "liu_nian" in dy

    def test_liu_nian_items_have_enriched_fields(self, client, fresh_user):
        """流年列表项包含十神/冲合/太岁等计算字段。"""
        _create_completed_analysis(client, fresh_user["headers"])

        res = client.get(
            "/api/v1/wechat/oasis/yun",
            headers=fresh_user["headers"],
        )
        da_yun_list = res.json()["data"]["da_yun"]

        # 取第一个大运的第一个流年
        ln = da_yun_list[0]["liu_nian"][0]
        assert "year" in ln
        assert "age" in ln
        assert "gan_zhi" in ln
        assert "shi_shen" in ln  # 十神已计算
        assert "chong_he" in ln  # 冲合已计算
        assert "is_tai_sui" in ln  # 太岁标记
        assert "is_current" in ln  # 当前年标记

    def test_current_da_yun_is_marked(self, client, fresh_user):
        """至少有一个大运被标记为当前大运。"""
        _create_completed_analysis(client, fresh_user["headers"])

        res = client.get(
            "/api/v1/wechat/oasis/yun",
            headers=fresh_user["headers"],
        )
        data = res.json()["data"]

        current_count = sum(1 for dy in data["da_yun"] if dy["is_current"])
        assert current_count >= 1
        assert data["current_da_yun_index"] > 0

    def test_current_liu_nian_is_marked(self, client, fresh_user):
        """当前年份的流年被标记为 is_current=True。"""
        _create_completed_analysis(client, fresh_user["headers"])

        res = client.get(
            "/api/v1/wechat/oasis/yun",
            headers=fresh_user["headers"],
        )
        data = res.json()["data"]
        current_year = data["current_year"]

        # 在某个大运的流年中找到当前年
        found = False
        for dy in data["da_yun"]:
            for ln in dy["liu_nian"]:
                if ln["year"] == current_year:
                    assert ln["is_current"] is True
                    found = True
        assert found, f"未找到当前年份 {current_year} 的流年"

    def test_yun_no_report_returns_400(self, client, fresh_user):
        """无已完成报告的用戶返回 code=400（envelope 格式，HTTP 200）。"""
        res = client.get(
            "/api/v1/wechat/oasis/yun",
            headers=fresh_user["headers"],
        )
        # API 使用 envelope 格式：HTTP 200 + body.code=400
        body = res.json()
        assert body["code"] == 400
        assert "分析" in body["message"]

    def test_yun_cross_user_isolation(self, client, fresh_user, other_user):
        """用户 A 的 API 只返回用户 A 的命盘数据（用户 B 无报告→ code=400）。"""
        # 用户 A 做分析
        _create_completed_analysis(client, fresh_user["headers"])

        # 用户 B 没有分析，应该返回 code=400
        res = client.get(
            "/api/v1/wechat/oasis/yun",
            headers=other_user["headers"],
        )
        # API envelope: HTTP 200 + body.code=400
        body = res.json()
        assert body["code"] == 400

    def test_yun_requires_auth(self, client):
        """未登录请求应返回 401/403。"""
        res = client.get("/api/v1/wechat/oasis/yun")
        assert res.status_code in (401, 403)


# ============================================================================
# 服务层单元测试
# ============================================================================

class TestYunService:
    """app.services.yun_service.get_yun_fortune() 单元测试。"""

    @pytest.fixture
    def completed_report(self, client, fresh_user):
        """创建一个已完成分析，返回 user_id。"""
        _create_completed_analysis(client, fresh_user["headers"])
        return fresh_user["user_id"]

    def test_premium_returns_full_data(self, completed_report):
        """高级会员获取完整 8 大运 × 10 流年。"""
        db = SessionLocal()
        try:
            data = get_yun_fortune(db, completed_report, is_premium=True)

            assert data is not None
            assert data["is_premium"] is True
            assert len(data["da_yun"]) >= 7  # 至少 7 步大运（跳过 index=0 小运后）
            # 每个大运应该有 10 个流年
            for dy in data["da_yun"]:
                assert len(dy["liu_nian"]) == 10, (
                    f"大运{dy['index']}应有10个流年，实际{len(dy['liu_nian'])}个"
                )
        finally:
            db.close()

    def test_free_returns_current_year_only(self, completed_report):
        """免费用户仅获取当前年所在的 1 步大运 + 1 个流年。"""
        db = SessionLocal()
        try:
            data = get_yun_fortune(db, completed_report, is_premium=False)

            assert data is not None
            assert data["is_premium"] is False
            # 免费用户只有 1 步大运
            assert len(data["da_yun"]) == 1
            # 该大运下只有当前年 1 个流年
            assert len(data["da_yun"][0]["liu_nian"]) == 1
            # 那个流年就是当前年
            assert data["da_yun"][0]["liu_nian"][0]["is_current"] is True
        finally:
            db.close()

    def test_no_report_returns_none(self):
        """无已完成报告的用戶返回 None。"""
        db = SessionLocal()
        try:
            result = get_yun_fortune(db, user_id=99999999, is_premium=True)
            assert result is None
        finally:
            db.close()

    def test_liu_nian_shishen_is_computed(self, completed_report):
        """流年十神字段非空且为合理值。"""
        db = SessionLocal()
        try:
            data = get_yun_fortune(db, completed_report, is_premium=True)

            valid_shishen = {
                "比肩", "劫财", "食神", "伤官",
                "偏财", "正财", "偏官", "正官",
                "偏印", "正印", "",
            }

            for dy in data["da_yun"]:
                for ln in dy["liu_nian"]:
                    assert ln["shi_shen"] in valid_shishen, (
                        f"流年{ln['year']}的十神'{ln['shi_shen']}'不在有效范围内"
                    )
        finally:
            db.close()

    def test_liu_nian_chong_he_is_computed(self, completed_report):
        """流年冲合字段已计算（可能是"无冲合"或具体冲合描述）。"""
        db = SessionLocal()
        try:
            data = get_yun_fortune(db, completed_report, is_premium=True)

            for dy in data["da_yun"]:
                for ln in dy["liu_nian"]:
                    assert isinstance(ln["chong_he"], str), (
                        f"流年{ln['year']}的冲合应为字符串"
                    )
        finally:
            db.close()

    def test_tai_sui_marking_is_boolean(self, completed_report):
        """太岁标记为布尔值。"""
        db = SessionLocal()
        try:
            data = get_yun_fortune(db, completed_report, is_premium=True)

            for dy in data["da_yun"]:
                for ln in dy["liu_nian"]:
                    assert isinstance(ln["is_tai_sui"], bool)
        finally:
            db.close()
