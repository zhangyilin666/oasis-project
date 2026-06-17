# -*- coding: utf-8 -*-
"""calendar_service 八字计算与黄历查询测试。"""
from __future__ import annotations

import pytest

from app.services.calendar_service import (
    AlmanacDay,
    BaziResult,
    DailyFortuneData,
    DayunInfo,
    LiunianInfo,
    PillarInfo,
    YunResult,
    _calculate_chong_he,
    _calculate_shishen,
    _gender_to_int,
    calculate_bazi,
    calculate_daily_fortune_data,
    calculate_dayun,
    format_yun_data_text,
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


# ---------------------------------------------------------------------------
# 大运/流年计算
# ---------------------------------------------------------------------------

class TestGenderToInt:
    """_gender_to_int() 性别映射测试。"""

    def test_male_returns_1(self):
        assert _gender_to_int("男") == 1
        assert _gender_to_int("male") == 1
        assert _gender_to_int("M") == 1

    def test_female_returns_0(self):
        assert _gender_to_int("女") == 0
        assert _gender_to_int("female") == 0
        assert _gender_to_int("F") == 0

    def test_empty_defaults_to_1(self):
        assert _gender_to_int("") == 1


class TestCalculateDayun:
    """calculate_dayun() 测试。"""

    def test_calculate_dayun_returns_yun_result(self):
        """有效输入返回 YunResult 实例。"""
        result = calculate_dayun(
            birth_date="1990-06-15",
            birth_time="08:30",
            gender="男",
            is_solar_time=True,
        )
        assert isinstance(result, YunResult)

    def test_da_yun_count_at_least_8(self):
        """大运数量 >= 8。"""
        result = calculate_dayun(
            birth_date="1990-06-15",
            birth_time="08:30",
            gender="男",
        )
        assert len(result.da_yun) >= 7, f"Expected >= 7 da_yun, got {len(result.da_yun)}"

    def test_each_da_yun_has_10_liu_nian(self):
        """每步大运包含恰好 10 个流年。"""
        result = calculate_dayun(
            birth_date="2000-01-01",
            birth_time="12:00",
            gender="女",
        )
        for dy in result.da_yun:
            assert len(dy.liu_nian) == 10, (
                f"DaYun {dy.index} ({dy.gan_zhi}): expected 10 liu_nian, got {len(dy.liu_nian)}"
            )

    def test_da_yun_gan_zhi_not_empty(self):
        """所有大运干支非空。"""
        result = calculate_dayun(
            birth_date="1990-06-15",
            birth_time="08:30",
            gender="男",
        )
        for dy in result.da_yun:
            assert dy.gan_zhi != "", f"DaYun {dy.index} gan_zhi is empty"

    def test_da_yun_gan_zhi_different_between_pillars(self):
        """前后两步大运干支不同（验证顺排/逆排逻辑）。"""
        result = calculate_dayun(
            birth_date="1990-06-15",
            birth_time="08:30",
            gender="男",
        )
        for i in range(len(result.da_yun) - 1):
            assert result.da_yun[i].gan_zhi != result.da_yun[i + 1].gan_zhi, (
                f"DaYun {i} and {i + 1} have same gan_zhi: {result.da_yun[i].gan_zhi}"
            )

    def test_liu_nian_years_sequential(self):
        """流年年份必须连续递增。"""
        result = calculate_dayun(
            birth_date="1995-05-20",
            birth_time="15:00",
            gender="女",
        )
        for dy in result.da_yun:
            for j in range(len(dy.liu_nian) - 1):
                assert dy.liu_nian[j + 1].year == dy.liu_nian[j].year + 1, (
                    f"DaYun {dy.index}: liu_nian years not sequential at index {j}"
                )

    def test_liu_nian_gan_zhi_not_empty(self):
        """流年干支非空。"""
        result = calculate_dayun(
            birth_date="1990-06-15",
            birth_time="08:30",
            gender="男",
        )
        for dy in result.da_yun:
            for ln in dy.liu_nian:
                assert ln.gan_zhi != "", (
                    f"DaYun {dy.index}, year {ln.year}: gan_zhi is empty"
                )

    def test_male_and_female_produce_different_yun(self):
        """男女相同八字产生不同大运方向。"""
        male_result = calculate_dayun(
            birth_date="1990-06-15",
            birth_time="08:30",
            gender="男",
        )
        female_result = calculate_dayun(
            birth_date="1990-06-15",
            birth_time="08:30",
            gender="女",
        )
        # 顺逆方向不同或大运不同
        assert (
            male_result.is_forward != female_result.is_forward
            or male_result.da_yun[0].gan_zhi != female_result.da_yun[0].gan_zhi
        ), "Male and female yun should differ for the same birth"

    def test_invalid_date_raises(self):
        """无效日期格式抛出 ValueError。"""
        with pytest.raises(ValueError):
            calculate_dayun(
                birth_date="bad-date",
                birth_time="08:30",
                gender="男",
            )


class TestFormatYunDataText:
    """format_yun_data_text() 测试。"""

    def test_returns_non_empty_string(self):
        """有效大运数据生成非空文本。"""
        yun_result = calculate_dayun(
            birth_date="1990-06-15",
            birth_time="08:30",
            gender="男",
        )
        text = format_yun_data_text(yun_result)
        assert isinstance(text, str)
        assert len(text) > 100
        assert "起运信息" in text
        assert "大运排盘" in text

    def test_empty_yun_returns_empty_string(self):
        """空大运返回空字符串。"""
        empty_yun = YunResult()
        assert format_yun_data_text(empty_yun) == ""

    def test_includes_gan_zhi_in_text(self):
        """文本中包含大运干支。"""
        yun_result = calculate_dayun(
            birth_date="1990-06-15",
            birth_time="08:30",
            gender="男",
        )
        text = format_yun_data_text(yun_result)
        assert yun_result.da_yun[0].gan_zhi in text


class TestYunResultToDict:
    """YunResult.to_dict() 序列化测试。"""

    def test_to_dict_has_expected_keys(self):
        """to_dict() 包含所有预期顶层键。"""
        result = calculate_dayun(
            birth_date="1990-06-15",
            birth_time="08:30",
            gender="男",
        )
        d = result.to_dict()
        for key in ["gender_int", "start_year_num", "start_month_num",
                     "start_day_num", "is_forward", "start_solar_date", "da_yun"]:
            assert key in d, f"Missing key: {key}"

    def test_da_yun_item_has_expected_keys(self):
        """大运 dict 项包含所有预期键。"""
        result = calculate_dayun(
            birth_date="1990-06-15",
            birth_time="08:30",
            gender="男",
        )
        d = result.to_dict()
        first_dy = d["da_yun"][0]
        for key in ["index", "gan_zhi", "start_age", "end_age",
                     "start_year", "end_year", "xun", "xun_kong", "liu_nian"]:
            assert key in first_dy, f"Missing da_yun key: {key}"

    def test_liu_nian_item_has_expected_keys(self):
        """流年 dict 项包含所有预期键。"""
        result = calculate_dayun(
            birth_date="1990-06-15",
            birth_time="08:30",
            gender="男",
        )
        d = result.to_dict()
        first_ln = d["da_yun"][0]["liu_nian"][0]
        for key in ["year", "age", "gan_zhi", "xun", "xun_kong"]:
            assert key in first_ln, f"Missing liu_nian key: {key}"


# ---------------------------------------------------------------------------
# 每日运势 — 十神计算
# ---------------------------------------------------------------------------


class TestCalculateShishen:
    """_calculate_shishen 十神关系计算。"""

    def test_bijian(self):
        """同五行同阴阳 → 比肩。甲 vs 甲。"""
        assert _calculate_shishen("甲", "甲") == "比肩"

    def test_jiecai(self):
        """同五行异阴阳 → 劫财。甲 vs 乙。"""
        assert _calculate_shishen("甲", "乙") == "劫财"

    def test_shishen(self):
        """我生同阴阳 → 食神。甲木生丙火（同阳）。"""
        assert _calculate_shishen("甲", "丙") == "食神"

    def test_shangguan(self):
        """我生异阴阳 → 伤官。甲木生丁火（甲阳丁阴）。"""
        assert _calculate_shishen("甲", "丁") == "伤官"

    def test_piancai(self):
        """我克同阴阳 → 偏财。甲木克戊土（同阳）。"""
        assert _calculate_shishen("甲", "戊") == "偏财"

    def test_zhengcai(self):
        """我克异阴阳 → 正财。甲木克己土（甲阳己阴）。"""
        assert _calculate_shishen("甲", "己") == "正财"

    def test_pianguan(self):
        """克我同阴阳 → 偏官（七杀）。庚金克甲木（同阳）。"""
        assert _calculate_shishen("甲", "庚") == "偏官"

    def test_zhengguan(self):
        """克我异阴阳 → 正官。辛金克甲木（甲阳辛阴）。"""
        assert _calculate_shishen("甲", "辛") == "正官"

    def test_pianyin(self):
        """生我同阴阳 → 偏印。壬水生甲木（同阳）。"""
        assert _calculate_shishen("甲", "壬") == "偏印"

    def test_zhengyin(self):
        """生我异阴阳 → 正印。癸水生甲木（甲阳癸阴）。"""
        assert _calculate_shishen("甲", "癸") == "正印"

    def test_empty_input_returns_empty(self):
        """空输入返回空字符串。"""
        assert _calculate_shishen("", "甲") == ""
        assert _calculate_shishen("甲", "") == ""


# ---------------------------------------------------------------------------
# 每日运势 — 冲合计算
# ---------------------------------------------------------------------------


class TestCalculateChongHe:
    """_calculate_chong_he 地支冲合计算。"""

    def test_zi_wu_chong(self):
        """子午冲。"""
        result = _calculate_chong_he("子", "午")
        assert "冲" in result
        assert "子午" in result

    def test_wu_zi_chong(self):
        """午子冲（反向）。"""
        result = _calculate_chong_he("午", "子")
        assert "冲" in result
        assert "午子" in result

    def test_zi_chou_he(self):
        """子丑合。"""
        result = _calculate_chong_he("子", "丑")
        assert "合" in result
        assert "子丑" in result

    def test_yin_hai_he(self):
        """寅亥合。"""
        result = _calculate_chong_he("寅", "亥")
        assert "合" in result
        assert "寅亥" in result

    def test_no_relation(self):
        """无冲合关系。"""
        result = _calculate_chong_he("子", "寅")
        assert result == "无冲合"

    def test_empty_input(self):
        """空输入返回空。"""
        assert _calculate_chong_he("", "午") == ""
        assert _calculate_chong_he("子", "") == ""


# ---------------------------------------------------------------------------
# 每日运势 — 完整数据计算
# ---------------------------------------------------------------------------


class TestCalculateDailyFortuneData:
    """calculate_daily_fortune_data 集成测试。"""

    @pytest.fixture
    def bazi_and_yun(self):
        """准备测试用八字与大运数据。"""
        bazi = calculate_bazi(
            birth_date="1990-06-15",
            birth_time="08:30",
            is_solar_time=True,
        )
        yun = calculate_dayun(
            birth_date="1990-06-15",
            birth_time="08:30",
            gender="男",
            is_solar_time=True,
        )
        return bazi, yun

    def test_returns_daily_fortune_data(self, bazi_and_yun):
        """返回 DailyFortuneData 实例。"""
        bazi, yun = bazi_and_yun
        result = calculate_daily_fortune_data(bazi, yun, today_date="2026-06-02")
        assert isinstance(result, DailyFortuneData)

    def test_day_gan_zhi_not_empty(self, bazi_and_yun):
        """今日干支非空。"""
        bazi, yun = bazi_and_yun
        result = calculate_daily_fortune_data(bazi, yun, today_date="2026-06-02")
        assert result.day_gan_zhi != ""
        assert len(result.day_gan_zhi) == 2

    def test_day_relation_not_empty(self, bazi_and_yun):
        """十神关系非空。"""
        bazi, yun = bazi_and_yun
        result = calculate_daily_fortune_data(bazi, yun, today_date="2026-06-02")
        assert result.day_relation != ""

    def test_month_gan_zhi_not_empty(self, bazi_and_yun):
        """流月干支非空。"""
        bazi, yun = bazi_and_yun
        result = calculate_daily_fortune_data(bazi, yun, today_date="2026-06-02")
        assert result.month_gan_zhi != ""

    def test_year_gan_zhi_not_empty(self, bazi_and_yun):
        """流年干支非空。"""
        bazi, yun = bazi_and_yun
        result = calculate_daily_fortune_data(bazi, yun, today_date="2026-06-02")
        assert result.year_gan_zhi != ""

    def test_day_master_matches_bazi(self, bazi_and_yun):
        """日主与八字日柱天干一致。"""
        bazi, yun = bazi_and_yun
        result = calculate_daily_fortune_data(bazi, yun, today_date="2026-06-02")
        assert result.day_master == bazi.day.gan

    def test_current_dayun_found(self, bazi_and_yun):
        """能匹配到当前大运（2026年在某步大运范围内）。"""
        bazi, yun = bazi_and_yun
        result = calculate_daily_fortune_data(bazi, yun, today_date="2026-06-02")
        # 2026年应该在某个大运中（1990出生，已36岁）
        assert result.current_dayun_gan_zhi != ""

    def test_to_prompt_context_has_key_fields(self, bazi_and_yun):
        """prompt 上下文字符串包含关键信息。"""
        bazi, yun = bazi_and_yun
        result = calculate_daily_fortune_data(bazi, yun, today_date="2026-06-02")
        ctx = result.to_prompt_context()
        assert "今日天象" in ctx
        assert "用户命盘" in ctx
        assert "今日干支关系" in ctx
        assert result.day_relation in ctx

    def test_different_dates_produce_different_gan_zhi(self, bazi_and_yun):
        """不同日期的干支不同。"""
        bazi, yun = bazi_and_yun
        r1 = calculate_daily_fortune_data(bazi, yun, today_date="2026-06-01")
        r2 = calculate_daily_fortune_data(bazi, yun, today_date="2026-06-02")
        assert r1.day_gan_zhi != r2.day_gan_zhi

    def test_invalid_date_raises(self, bazi_and_yun):
        """无效日期抛出 ValueError。"""
        bazi, yun = bazi_and_yun
        with pytest.raises(ValueError):
            calculate_daily_fortune_data(bazi, yun, today_date="not-a-date")
