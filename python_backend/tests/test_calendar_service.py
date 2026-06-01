# -*- coding: utf-8 -*-
"""calendar_service 八字计算与黄历查询测试。"""
from __future__ import annotations

import pytest

from app.services.calendar_service import (
    AlmanacDay,
    BaziResult,
    PillarInfo,
    calculate_bazi,
    get_day_almanac,
)


# ---------------------------------------------------------------------------
# 八字计算
# ---------------------------------------------------------------------------

class TestCalculateBazi:
    """calculate_bazi() 测试。"""

    # ---- 正常输入 ----

    def test_calculate_bazi_valid_date_returns_bazi_result(self):
        """有效日期返回 BaziResult 实例。"""
        result = calculate_bazi(
            birth_date="1990-06-15",
            birth_time="08:30",
            is_solar_time=True,
        )
        assert isinstance(result, BaziResult)

    def test_bazi_four_pillars_not_empty(self):
        """四柱均不为空。"""
        result = calculate_bazi(
            birth_date="1990-06-15",
            birth_time="08:30",
            is_solar_time=True,
        )
        for pillar_name, pillar in [
            ("year", result.year),
            ("month", result.month),
            ("day", result.day),
            ("hour", result.hour),
        ]:
            assert pillar.gan_zhi != "", f"{pillar_name} gan_zhi is empty"
            assert pillar.gan != "", f"{pillar_name} gan is empty"
            assert pillar.zhi != "", f"{pillar_name} zhi is empty"

    def test_calculate_bazi_lunar_info_populated(self):
        """农历信息被填充。"""
        result = calculate_bazi(
            birth_date="1990-06-15",
            birth_time="08:30",
            is_solar_time=True,
        )
        assert result.lunar_year != 0
        assert result.lunar_month != 0
        assert result.lunar_day != 0
        assert result.animal != ""

    def test_full_bazi_format(self):
        """full_bazi 是 'X X X X' 格式（四柱以空格分隔）。"""
        result = calculate_bazi(
            birth_date="1990-06-15",
            birth_time="08:30",
            is_solar_time=True,
        )
        parts = result.full_bazi.split()
        assert len(parts) == 4, f"Expected 4 pillars, got: {result.full_bazi}"
        for part in parts:
            assert len(part) == 2, f"Each pillar should be 2 chars, got: {part}"

    def test_to_dict_has_expected_keys(self):
        """to_dict() 包含所有预期键。"""
        result = calculate_bazi(
            birth_date="1990-06-15",
            birth_time="08:30",
            is_solar_time=True,
        )
        d = result.to_dict()
        for key in ["year", "month", "day", "hour", "full_bazi",
                     "wu_xing_summary", "lunar_year", "lunar_month",
                     "lunar_day", "animal", "ming_gong", "shen_gong", "tai_yuan"]:
            assert key in d, f"Missing key: {key}"

        for pillar_key in ["gan_zhi", "gan", "zhi", "na_yin", "wu_xing"]:
            assert pillar_key in d["year"], f"Missing pillar key: year.{pillar_key}"

    # ---- 边界与错误 ----

    def test_calculate_bazi_different_birth_times(self):
        """不同时辰产生不同时柱。"""
        morning = calculate_bazi(
            birth_date="1990-06-15",
            birth_time="03:00",
            is_solar_time=True,
        )
        afternoon = calculate_bazi(
            birth_date="1990-06-15",
            birth_time="15:00",
            is_solar_time=True,
        )
        # 年、月、日柱相同，时柱不同
        assert morning.year.gan_zhi == afternoon.year.gan_zhi
        assert morning.hour.gan_zhi != afternoon.hour.gan_zhi

    def test_calculate_bazi_with_lunar_input(self):
        """传入农历日期（is_solar_time=False）也能计算。"""
        result = calculate_bazi(
            birth_date="1990-05-23",  # 农历五月廿三
            birth_time="08:30",
            is_solar_time=False,
        )
        assert isinstance(result, BaziResult)
        assert result.full_bazi != ""

    def test_calculate_bazi_invalid_date_format_raises(self):
        """无效日期格式应抛出异常。"""
        with pytest.raises(ValueError):
            calculate_bazi(
                birth_date="not-a-date",
                birth_time="08:30",
                is_solar_time=True,
            )


# ---------------------------------------------------------------------------
# 八字结果属性
# ---------------------------------------------------------------------------

class TestBaziResultProperties:
    """BaziResult 的 computed properties。"""

    def test_full_bazi_is_four_gan_zhi(self):
        """full_bazi 返回 4 个干支组合。"""
        result = calculate_bazi(
            birth_date="2000-01-01",
            birth_time="12:00",
            is_solar_time=True,
        )
        pillars = result.full_bazi.split()
        assert len(pillars) == 4

    def test_wu_xing_summary_has_five_elements(self):
        """五行统计包含金木水火土。"""
        result = calculate_bazi(
            birth_date="2000-01-01",
            birth_time="12:00",
            is_solar_time=True,
        )
        summary = result.wu_xing_summary
        for elem in ["金", "木", "水", "火", "土"]:
            assert elem in summary


# ---------------------------------------------------------------------------
# 黄历查询
# ---------------------------------------------------------------------------

class TestGetDayAlmanac:
    """get_day_almanac() 测试。"""

    def test_get_day_almanac_returns_almanac_day(self):
        """返回 AlmanacDay 实例。"""
        almanac = get_day_almanac("2024-06-15")
        assert isinstance(almanac, AlmanacDay)

    def test_get_day_almanac_has_gan_zhi(self):
        """黄历包含当日干支。"""
        almanac = get_day_almanac("2024-06-15")
        assert almanac.day_gan_zhi != ""

    def test_get_day_almanac_has_animal(self):
        """黄历包含生肖。"""
        almanac = get_day_almanac("2024-06-15")
        assert almanac.animal != ""

    def test_get_day_almanac_has_lunar_date(self):
        """黄历包含农历日期。"""
        almanac = get_day_almanac("2024-06-15")
        assert almanac.lunar_date != ""

    def test_to_dict_has_expected_keys(self):
        """to_dict() 包含预期键。"""
        almanac = get_day_almanac("2024-06-15")
        d = almanac.to_dict()
        for key in ["solar_date", "lunar_date", "day_gan_zhi",
                     "animal", "yi", "ji", "ji_shen", "xiong_sha"]:
            assert key in d, f"Missing key: {key}"
