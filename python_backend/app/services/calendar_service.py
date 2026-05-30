# -*- coding: utf-8 -*-
"""
农历历法计算服务。

基于 lunar-python 库提供：
  - 公历↔农历转换
  - 八字四柱计算（年柱/月柱/日柱/时柱）
  - 十二宫 / 五行 / 纳音 / 十神
  - 黄历宜忌查询
  - 生肖 / 节气

所有方法签名使用完整的 Python 类型提示。
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Optional

from lunar_python import EightChar, Lunar, Solar

from app.core.logger import logger


# ---------------------------------------------------------------------------
# 数据模型
# ---------------------------------------------------------------------------

@dataclass
class PillarInfo:
    """一柱（年/月/日/时）的完整信息。"""

    gan_zhi: str = ""  # 干支组合，如 "庚午"
    gan: str = ""  # 天干
    zhi: str = ""  # 地支
    na_yin: str = ""  # 纳音，如 "路旁土"
    wu_xing: str = ""  # 五行
    shi_shen_gan: str = ""  # 十神（天干）
    shi_shen_zhi: str = ""  # 十神（地支）
    di_shi: str = ""  # 地势（十二运）
    hide_gan: str = ""  # 藏干
    xun: str = ""  # 旬
    xun_kong: str = ""  # 旬空


@dataclass
class BaziResult:
    """八字计算结果。"""

    # 四柱
    year: PillarInfo = field(default_factory=PillarInfo)
    month: PillarInfo = field(default_factory=PillarInfo)
    day: PillarInfo = field(default_factory=PillarInfo)
    hour: PillarInfo = field(default_factory=PillarInfo)

    # 辅助信息
    lunar_year: int = 0
    lunar_month: int = 0
    lunar_day: int = 0
    lunar_year_cn: str = ""
    lunar_month_cn: str = ""
    lunar_day_cn: str = ""
    animal: str = ""  # 生肖
    ming_gong: str = ""  # 命宫
    shen_gong: str = ""  # 身宫
    tai_yuan: str = ""  # 胎元

    @property
    def full_bazi(self) -> str:
        """八字四柱字符串，如 '庚午 辛巳 乙酉 丙子'。"""
        return " ".join([self.year.gan_zhi, self.month.gan_zhi, self.day.gan_zhi, self.hour.gan_zhi])

    @property
    def wu_xing_summary(self) -> dict:
        """五行分布统计。"""
        wu_xing_map = {"金": 0, "木": 0, "水": 0, "火": 0, "土": 0}
        for p in [self.year, self.month, self.day, self.hour]:
            for k in wu_xing_map:
                if k in p.na_yin:
                    wu_xing_map[k] += 1
        return wu_xing_map

    def to_dict(self) -> dict:
        """转为字典，便于 JSON 序列化。"""

        def pillar_to_dict(p: PillarInfo) -> dict:
            return {
                "gan_zhi": p.gan_zhi,
                "gan": p.gan,
                "zhi": p.zhi,
                "na_yin": p.na_yin,
                "wu_xing": p.wu_xing,
                "shi_shen_gan": p.shi_shen_gan,
                "shi_shen_zhi": p.shi_shen_zhi,
                "di_shi": p.di_shi,
                "hide_gan": p.hide_gan,
                "xun": p.xun,
                "xun_kong": p.xun_kong,
            }

        return {
            "year": pillar_to_dict(self.year),
            "month": pillar_to_dict(self.month),
            "day": pillar_to_dict(self.day),
            "hour": pillar_to_dict(self.hour),
            "full_bazi": self.full_bazi,
            "wu_xing_summary": self.wu_xing_summary,
            "lunar_year": self.lunar_year,
            "lunar_month": self.lunar_month,
            "lunar_day": self.lunar_day,
            "lunar_year_cn": self.lunar_year_cn,
            "lunar_month_cn": self.lunar_month_cn,
            "lunar_day_cn": self.lunar_day_cn,
            "animal": self.animal,
            "ming_gong": self.ming_gong,
            "shen_gong": self.shen_gong,
            "tai_yuan": self.tai_yuan,
        }


@dataclass
class AlmanacDay:
    """黄历单日宜忌。"""

    solar_date: str = ""
    lunar_date: str = ""
    lunar_year_cn: str = ""
    lunar_month_cn: str = ""
    lunar_day_cn: str = ""
    day_gan_zhi: str = ""
    animal: str = ""
    yi: list[str] = field(default_factory=list)  # 宜
    ji: list[str] = field(default_factory=list)  # 忌
    ji_shen: list[str] = field(default_factory=list)  # 吉神
    xiong_sha: list[str] = field(default_factory=list)  # 凶煞
    chong_sheng_xiao: str = ""  # 冲生肖

    def to_dict(self) -> dict:
        return {
            "solar_date": self.solar_date,
            "lunar_date": self.lunar_date,
            "lunar_year_cn": self.lunar_year_cn,
            "lunar_month_cn": self.lunar_month_cn,
            "lunar_day_cn": self.lunar_day_cn,
            "day_gan_zhi": self.day_gan_zhi,
            "animal": self.animal,
            "yi": self.yi,
            "ji": self.ji,
            "ji_shen": self.ji_shen,
            "xiong_sha": self.xiong_sha,
            "chong_sheng_xiao": self.chong_sheng_xiao,
        }


# ---------------------------------------------------------------------------
# 内部工具函数
# ---------------------------------------------------------------------------

def _safe_str(value: Any) -> str:
    """
    安全转为纯文本字符串。

    lunar-python 某些方法返回 list（如 getYearShiShenZhi → ['食神', '偏财']），
    某些返回含 <span> 的 HTML 字符串。此函数统一处理两种情况。
    """
    if isinstance(value, list):
        return "、".join(_strip_tags(str(v)) for v in value)
    return _strip_tags(str(value)) if value else ""


def _strip_tags(text: str) -> str:
    """移除 HTML 标签，保留纯文本。"""
    return re.sub(r"<[^>]+>", "", text)


def _extract_pillar(lunar_obj: Lunar, time_gan_zhi: str, get_pillar_fn, get_gan_fn, get_zhi_fn) -> PillarInfo:
    """通用方法：从 Lunar/EightChar 对象提取一柱信息。"""
    try:
        return PillarInfo(
            gan_zhi=_safe_str(get_pillar_fn()),
            gan=_safe_str(get_gan_fn()),
            zhi=_safe_str(get_zhi_fn()),
            na_yin=_safe_str(lunar_obj.getDayNaYin() if get_pillar_fn.__name__ == "getDay" else ""),
        )
    except Exception:
        return PillarInfo(gan_zhi=time_gan_zhi)


def _parse_birth_time(birth_time: str) -> tuple[int, int]:
    """
    将出生时间字符串解析为 (hour, minute)。

    支持格式: 'HH:MM'、'HH:MM:SS'
    """
    parts = birth_time.strip().split(":")
    hour = int(parts[0]) if len(parts) >= 1 else 0
    minute = int(parts[1]) if len(parts) >= 2 else 0
    return hour, minute


def _get_time_gan_zhi(lunar_obj: Lunar, hour: int) -> str:
    """
    根据出生时辰获取时柱干支。

    使用 lunar-python 的 getTimeInGanZhi() 方法，
    需要根据小时数确定时辰索引（每个时辰 2 小时）。
    """
    try:
        solar = lunar_obj.getSolar()
        # 用具体的小时+分钟构建时间
        solar_with_time = Solar.fromYmdHms(
            solar.getYear(), solar.getMonth(), solar.getDay(),
            hour, 0, 0,
        )
        lunar_with_time = solar_with_time.getLunar()
        return lunar_with_time.getTimeInGanZhi()
    except Exception:
        return lunar_obj.getTimeInGanZhi()


# ---------------------------------------------------------------------------
# 核心计算函数
# ---------------------------------------------------------------------------

def calculate_bazi(
    birth_date: str,
    birth_time: str,
    is_solar_time: bool = True,
) -> BaziResult:
    """
    计算八字四柱与十二宫信息。

    Args:
        birth_date: 出生日期。公历格式 'YYYY-MM-DD'，
                    农历格式 'YYYY-M-D'（需设 is_solar_time=False）。
        birth_time: 出生时间，格式 'HH:MM' 或 'HH:MM:SS'。
        is_solar_time: True 表示 birth_date 为公历，False 为农历。

    Returns:
        BaziResult 包含四柱完整信息、十二宫、五行分布。

    Raises:
        ValueError: 日期或时间格式无效。
    """
    # 解析日期
    date_match = re.match(r"^(\d{4})-(\d{1,2})-(\d{1,2})$", birth_date)
    if not date_match:
        raise ValueError(f"Invalid birth_date format: {birth_date}, expected YYYY-MM-DD")
    year, month, day = int(date_match.group(1)), int(date_match.group(2)), int(date_match.group(3))

    # 解析时间
    hour, minute = _parse_birth_time(birth_time)

    logger.info(
        "Calculating Bazi: date=%s (is_solar=%s), time=%02d:%02d",
        birth_date, is_solar_time, hour, minute,
    )

    # 构建 Solar → Lunar
    if is_solar_time:
        solar = Solar.fromYmdHms(year, month, day, hour, minute, 0)
        lunar = solar.getLunar()
    else:
        lunar = Lunar.fromYmdHms(year, month, day, hour, minute, 0)
        solar = lunar.getSolar()

    eight_char: EightChar = lunar.getEightChar()

    # --- 提取四柱 ---
    def _build_pillar(get_pillar_fn, get_gan_fn, get_zhi_fn, na_yin_fn, wu_xing_fn, shi_shen_gan_fn, shi_shen_zhi_fn, di_shi_fn, hide_gan_fn, xun_fn, xun_kong_fn):
        return PillarInfo(
            gan_zhi=_safe_str(get_pillar_fn()),
            gan=_safe_str(get_gan_fn()),
            zhi=_safe_str(get_zhi_fn()),
            na_yin=_safe_str(na_yin_fn()),
            wu_xing=_safe_str(wu_xing_fn()),
            shi_shen_gan=_safe_str(shi_shen_gan_fn()),
            shi_shen_zhi=_safe_str(shi_shen_zhi_fn()),
            di_shi=_safe_str(di_shi_fn()),
            hide_gan=_safe_str(hide_gan_fn()),
            xun=_safe_str(xun_fn()),
            xun_kong=_safe_str(xun_kong_fn()),
        )

    year_pillar = _build_pillar(
        eight_char.getYear, eight_char.getYearGan, eight_char.getYearZhi,
        eight_char.getYearNaYin, eight_char.getYearWuXing,
        eight_char.getYearShiShenGan, eight_char.getYearShiShenZhi,
        eight_char.getYearDiShi, eight_char.getYearHideGan,
        eight_char.getYearXun, eight_char.getYearXunKong,
    )

    month_pillar = _build_pillar(
        eight_char.getMonth, eight_char.getMonthGan, eight_char.getMonthZhi,
        eight_char.getMonthNaYin, eight_char.getMonthWuXing,
        eight_char.getMonthShiShenGan, eight_char.getMonthShiShenZhi,
        eight_char.getMonthDiShi, eight_char.getMonthHideGan,
        eight_char.getMonthXun, eight_char.getMonthXunKong,
    )

    day_pillar = _build_pillar(
        eight_char.getDay, eight_char.getDayGan, eight_char.getDayZhi,
        eight_char.getDayNaYin, eight_char.getDayWuXing,
        eight_char.getDayShiShenGan, eight_char.getDayShiShenZhi,
        eight_char.getDayDiShi, eight_char.getDayHideGan,
        eight_char.getDayXun, eight_char.getDayXunKong,
    )

    time_pillar = _build_pillar(
        eight_char.getTime, eight_char.getTimeGan, eight_char.getTimeZhi,
        eight_char.getTimeNaYin, eight_char.getTimeWuXing,
        eight_char.getTimeShiShenGan, eight_char.getTimeShiShenZhi,
        eight_char.getTimeDiShi, eight_char.getTimeHideGan,
        eight_char.getTimeXun, eight_char.getTimeXunKong,
    )

    # --- 构建结果 ---
    result = BaziResult(
        year=year_pillar,
        month=month_pillar,
        day=day_pillar,
        hour=time_pillar,
        lunar_year=lunar.getYear(),
        lunar_month=lunar.getMonth(),
        lunar_day=lunar.getDay(),
        lunar_year_cn=_safe_str(lunar.getYearInChinese()),
        lunar_month_cn=_safe_str(lunar.getMonthInChinese()),
        lunar_day_cn=_safe_str(lunar.getDayInChinese()),
        animal=_safe_str(lunar.getAnimal()),
        ming_gong=_safe_str(eight_char.getMingGong()),
        shen_gong=_safe_str(eight_char.getShenGong()),
        tai_yuan=_safe_str(eight_char.getTaiYuan()),
    )

    logger.info("Bazi result: %s", result.full_bazi)
    return result


def get_day_almanac(solar_date: Optional[str] = None) -> AlmanacDay:
    """
    获取指定日期或今天的黄历宜忌。

    Args:
        solar_date: 公历日期 'YYYY-MM-DD'，默认为今天。

    Returns:
        AlmanacDay 包含当日宜忌、吉神凶煞、冲生肖等信息。
    """
    if solar_date is None:
        now = datetime.now()
        solar = Solar.fromYmdHms(now.year, now.month, now.day, 12, 0, 0)
        solar_date = f"{now.year}-{now.month:02d}-{now.day:02d}"
    else:
        date_match = re.match(r"^(\d{4})-(\d{1,2})-(\d{1,2})$", solar_date)
        if not date_match:
            raise ValueError(f"Invalid solar_date format: {solar_date}, expected YYYY-MM-DD")
        y, m, d = int(date_match.group(1)), int(date_match.group(2)), int(date_match.group(3))
        solar = Solar.fromYmdHms(y, m, d, 12, 0, 0)

    lunar = solar.getLunar()

    # 宜忌可能返回列表或逗号分隔字符串，统一处理
    def _to_list(value: Any) -> list[str]:
        if isinstance(value, list):
            return [_safe_str(v) for v in value]
        if isinstance(value, str):
            return [_safe_str(s.strip()) for s in value.replace("，", ",").split(",") if s.strip()]
        return []

    yi_list = _to_list(lunar.getDayYi())
    ji_list = _to_list(lunar.getDayJi())

    # 吉神凶煞
    ji_shen_raw = lunar.getDayJiShen()
    xiong_sha_raw = lunar.getDayXiongSha()

    return AlmanacDay(
        solar_date=solar_date,
        lunar_date=f"{lunar.getYear()}-{lunar.getMonth()}-{lunar.getDay()}",
        lunar_year_cn=_safe_str(lunar.getYearInChinese()),
        lunar_month_cn=_safe_str(lunar.getMonthInChinese()),
        lunar_day_cn=_safe_str(lunar.getDayInChinese()),
        day_gan_zhi=_safe_str(lunar.getDayInGanZhi()),
        animal=_safe_str(lunar.getAnimal()),
        yi=yi_list,
        ji=ji_list,
        ji_shen=_to_list(ji_shen_raw) if ji_shen_raw else [],
        xiong_sha=_to_list(xiong_sha_raw) if xiong_sha_raw else [],
        chong_sheng_xiao=_safe_str(lunar.getDayChongShengXiao()),
    )


def convert_solar_to_lunar(solar_date: str) -> dict:
    """
    公历转农历（简化接口）。

    Args:
        solar_date: 公历日期 'YYYY-MM-DD'。

    Returns:
        包含农历年/月/日/生肖/干支日/节气等信息的字典。
    """
    date_match = re.match(r"^(\d{4})-(\d{1,2})-(\d{1,2})$", solar_date)
    if not date_match:
        raise ValueError(f"Invalid solar_date format: {solar_date}")

    y, m, d = int(date_match.group(1)), int(date_match.group(2)), int(date_match.group(3))
    solar = Solar.fromYmd(y, m, d)
    luna = solar.getLunar()

    return {
        "solar_date": solar_date,
        "lunar_year": luna.getYear(),
        "lunar_month": luna.getMonth(),
        "lunar_day": luna.getDay(),
        "lunar_year_cn": luna.getYearInChinese(),
        "lunar_month_cn": luna.getMonthInChinese(),
        "lunar_day_cn": luna.getDayInChinese(),
        "year_gan_zhi": luna.getYearInGanZhi(),
        "month_gan_zhi": luna.getMonthInGanZhi(),
        "day_gan_zhi": luna.getDayInGanZhi(),
        "animal": luna.getAnimal(),
        "week_cn": solar.getWeekInChinese(),
        "jie_qi": luna.getCurrentJieQi() or "",
        "day_yi": luna.getDayYi() if callable(getattr(luna, "getDayYi", None)) else [],
        "day_ji": luna.getDayJi() if callable(getattr(luna, "getDayJi", None)) else [],
    }
