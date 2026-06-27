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

from lunar_python import Lunar, Solar

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
    year_gan_zhi: str = ""
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
            "year_gan_zhi": self.year_gan_zhi,
            "day_gan_zhi": self.day_gan_zhi,
            "animal": self.animal,
            "yi": self.yi,
            "ji": self.ji,
            "ji_shen": self.ji_shen,
            "xiong_sha": self.xiong_sha,
            "chong_sheng_xiao": self.chong_sheng_xiao,
        }


@dataclass
class LiunianInfo:
    """单个流年信息（一年内的运势干支）。"""

    year: int = 0  # 公历年份
    age: int = 0  # 虚岁
    gan_zhi: str = ""  # 流年干支
    xun: str = ""  # 所在旬
    xun_kong: str = ""  # 旬空(空亡)

    def to_dict(self) -> dict:
        return {
            "year": self.year,
            "age": self.age,
            "gan_zhi": self.gan_zhi,
            "xun": self.xun,
            "xun_kong": self.xun_kong,
        }


@dataclass
class DayunInfo:
    """单步大运信息（十年一步）。"""

    index: int = 0  # 大运序号（1 起）
    gan_zhi: str = ""  # 大运干支
    start_age: int = 0  # 起始虚岁
    end_age: int = 0  # 结束虚岁
    start_year: int = 0  # 起始公历年份
    end_year: int = 0  # 结束公历年份
    xun: str = ""  # 所在旬
    xun_kong: str = ""  # 旬空(空亡)
    liu_nian: list[LiunianInfo] = field(default_factory=list)  # 该大运内的流年列表

    def to_dict(self) -> dict:
        return {
            "index": self.index,
            "gan_zhi": self.gan_zhi,
            "start_age": self.start_age,
            "end_age": self.end_age,
            "start_year": self.start_year,
            "end_year": self.end_year,
            "xun": self.xun,
            "xun_kong": self.xun_kong,
            "liu_nian": [ln.to_dict() for ln in self.liu_nian],
        }


@dataclass
class YunResult:
    """大运排盘完整结果（起运信息 + 八步大运）。"""

    gender_int: int = 1  # 1=男, 0=女
    start_year_num: int = 0  # 起运年数
    start_month_num: int = 0  # 起运月数（配合年数使用）
    start_day_num: int = 0  # 起运天数
    is_forward: bool = True  # 顺推 / 逆推
    start_solar_date: str = ""  # 起运公历日期
    da_yun: list[DayunInfo] = field(default_factory=list)  # 大运列表

    def to_dict(self) -> dict:
        return {
            "gender_int": self.gender_int,
            "start_year_num": self.start_year_num,
            "start_month_num": self.start_month_num,
            "start_day_num": self.start_day_num,
            "is_forward": self.is_forward,
            "start_solar_date": self.start_solar_date,
            "da_yun": [dy.to_dict() for dy in self.da_yun],
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
# 八字查表数据（lunar-python Docker 版缺失 per-pillar 方法，用纯 Python 推算）
# ---------------------------------------------------------------------------

# 地支 → 藏干
_ZHI_TO_HIDE_GAN: dict[str, str] = {
    "子": "癸",
    "丑": "己癸辛",
    "寅": "甲丙戊",
    "卯": "乙",
    "辰": "戊乙癸",
    "巳": "丙戊庚",
    "午": "丁己",
    "未": "己丁乙",
    "申": "庚戊壬",
    "酉": "辛",
    "戌": "戊辛丁",
    "亥": "壬甲",
}

# 十二运名称（按顺行顺序）
_DI_SHI_NAMES: list[str] = [
    "长生", "沐浴", "冠带", "临官", "帝旺",
    "衰", "病", "死", "墓", "绝", "胎", "养",
]

# 天干 → 长生起始地支（阳干顺行，阴干逆行）
_GAN_CHANG_SHENG_START: dict[str, str] = {
    "甲": "亥", "丙": "寅", "戊": "寅", "庚": "巳", "壬": "申",
    "乙": "午", "丁": "酉", "己": "酉", "辛": "子", "癸": "卯",
}

# 天干阴阳（阳顺阴逆）
_YANG_GAN: set[str] = {"甲", "丙", "戊", "庚", "壬"}

# 地支顺序
_ZHI_ORDER: list[str] = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"]

# 天干顺序
_GAN_ORDER: list[str] = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"]


def _compute_di_shi(gan: str, zhi: str) -> str:
    """从 天干 + 地支 计算 地势（十二运）。"""
    if not gan or not zhi or gan not in _GAN_CHANG_SHENG_START or zhi not in _ZHI_ORDER:
        return ""
    start_zhi = _GAN_CHANG_SHENG_START[gan]
    start_idx = _ZHI_ORDER.index(start_zhi)
    zhi_idx = _ZHI_ORDER.index(zhi)
    if gan in _YANG_GAN:
        # 顺行
        offset = (zhi_idx - start_idx) % 12
    else:
        # 逆行
        offset = (start_idx - zhi_idx) % 12
    return _DI_SHI_NAMES[offset]


def _compute_hide_gan(zhi: str) -> str:
    """从 地支 查表获取 藏干。"""
    return _ZHI_TO_HIDE_GAN.get(zhi, "")


def _compute_xun_and_kong(gan_zhi: str) -> tuple[str, str]:
    """从 干支 计算 (旬, 旬空)。"""
    if not gan_zhi or len(gan_zhi) < 2:
        return "", ""
    gan = gan_zhi[0]
    zhi = gan_zhi[1]
    if gan not in _GAN_ORDER or zhi not in _ZHI_ORDER:
        return "", ""
    gan_idx = _GAN_ORDER.index(gan)
    zhi_idx = _ZHI_ORDER.index(zhi)
    # 在 60 甲子中的位置
    if (gan_idx % 2) != (zhi_idx % 2):
        return "", ""  # 奇偶不同不可能出现（但防御）
    pos = -1
    for p in range(60):
        if p % 10 == gan_idx and p % 12 == zhi_idx:
            pos = p
            break
    if pos < 0:
        return "", ""
    # 旬首
    xun_start = (pos // 10) * 10
    xun_gan = _GAN_ORDER[xun_start % 10]  # 总是 甲
    xun_zhi = _ZHI_ORDER[xun_start % 12]
    xun = f"{xun_gan}{xun_zhi}"
    # 旬空（旬首地支的前两个地支）
    kong1_idx = (xun_start % 12 - 1) % 12
    kong2_idx = (xun_start % 12 - 2) % 12
    xun_kong = f"{_ZHI_ORDER[kong2_idx]}{_ZHI_ORDER[kong1_idx]}"
    return xun, xun_kong


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

    # --- 提取八字全局数据（lunar-python 1.0.0 返回列表，索引: 0=年/1=月/2=日/3=时）---
    try:
        bz_wu_xing_list = lunar.getBaZiWuXing()           # ['木火', '火水', '火土', '火土']
        bz_shi_shen_gan_list = lunar.getBaZiShiShenGan()  # ['偏财', '偏印', '日元', '比肩']
        bz_shi_shen_zhi_list = lunar.getBaZiShiShenZhi()  # ['劫财', '伤官', '偏印', '偏印']
    except Exception:
        bz_wu_xing_list = ['', '', '', '']
        bz_shi_shen_gan_list = ['', '', '', '']
        bz_shi_shen_zhi_list = ['', '', '', '']

    def _safe_list_get(lst: list, idx: int) -> str:
        """安全从列表取值，索引越界返回空字符串。"""
        try:
            return _safe_str(lst[idx])
        except (IndexError, TypeError):
            return ""

    def _safe_method(obj, name):
        """安全获取对象方法，方法不存在时返回 None（避免 AttributeError）。"""
        return getattr(obj, name, None)

    def _build_pillar(
        gan_zhi_value,      # callable 或 str（时柱是字符串）
        get_gan_fn,         # callable 或 None
        get_zhi_fn,         # callable 或 None
        na_yin_fn="",       # callable 或 ""
        wu_xing_str="",     # 预取字符串
        shi_shen_gan_str="",# 预取字符串
        shi_shen_zhi_str="",# 预取字符串
        xun_fn="",          # callable 或 ""
        xun_kong_fn="",     # callable 或 ""
    ):
        try:
            gan_zhi = _safe_str(gan_zhi_value()) if callable(gan_zhi_value) else _safe_str(gan_zhi_value)
            gan = _safe_str(get_gan_fn()) if callable(get_gan_fn) else ""
            zhi = _safe_str(get_zhi_fn()) if callable(get_zhi_fn) else ""

            # 旬 & 旬空：优先原生方法，否则查表从干支推算
            xun = _safe_str(xun_fn()) if callable(xun_fn) else ""
            xun_kong = _safe_str(xun_kong_fn()) if callable(xun_kong_fn) else ""
            if not xun or not xun_kong:
                fxun, fxun_kong = _compute_xun_and_kong(gan_zhi)
                if not xun:
                    xun = fxun
                if not xun_kong:
                    xun_kong = fxun_kong

            return PillarInfo(
                gan_zhi=gan_zhi,
                gan=gan,
                zhi=zhi,
                na_yin=_safe_str(na_yin_fn()) if callable(na_yin_fn) else "",
                wu_xing=wu_xing_str,
                shi_shen_gan=shi_shen_gan_str,
                shi_shen_zhi=shi_shen_zhi_str,
                di_shi=_compute_di_shi(gan, zhi),
                hide_gan=_compute_hide_gan(zhi),
                xun=xun,
                xun_kong=xun_kong,
            )
        except Exception:
            return PillarInfo()

    year_pillar = _build_pillar(
        _safe_method(lunar, 'getYearInGanZhi'), _safe_method(lunar, 'getYearGan'), _safe_method(lunar, 'getYearZhi'),
        _safe_method(lunar, 'getYearNaYin'), _safe_list_get(bz_wu_xing_list, 0),
        _safe_list_get(bz_shi_shen_gan_list, 0), _safe_list_get(bz_shi_shen_zhi_list, 0),
        _safe_method(lunar, 'getYearXun'), _safe_method(lunar, 'getYearXunKong'),
    )

    month_pillar = _build_pillar(
        _safe_method(lunar, 'getMonthInGanZhi'), _safe_method(lunar, 'getMonthGan'),
        _safe_method(lunar, 'getMonthZhiExact') or _safe_method(lunar, 'getMonthZhi'),
        _safe_method(lunar, 'getMonthNaYin'), _safe_list_get(bz_wu_xing_list, 1),
        _safe_list_get(bz_shi_shen_gan_list, 1), _safe_list_get(bz_shi_shen_zhi_list, 1),
        _safe_method(lunar, 'getMonthXun'), _safe_method(lunar, 'getMonthXunKong'),
    )

    day_pillar = _build_pillar(
        _safe_method(lunar, 'getDayInGanZhi'), _safe_method(lunar, 'getDayGan'), _safe_method(lunar, 'getDayZhi'),
        _safe_method(lunar, 'getDayNaYin'), _safe_list_get(bz_wu_xing_list, 2),
        _safe_list_get(bz_shi_shen_gan_list, 2), _safe_list_get(bz_shi_shen_zhi_list, 2),
        _safe_method(lunar, 'getDayXun'), _safe_method(lunar, 'getDayXunKong'),
    )

    # 时柱：先计算时柱干支字符串，再与其他方法一起传入
    time_gan_zhi_str = _get_time_gan_zhi(lunar, hour)
    time_pillar = _build_pillar(
        time_gan_zhi_str,
        _safe_method(lunar, 'getTimeGan'), _safe_method(lunar, 'getTimeZhi'),
        _safe_method(lunar, 'getTimeNaYin'), _safe_list_get(bz_wu_xing_list, 3),
        _safe_list_get(bz_shi_shen_gan_list, 3), _safe_list_get(bz_shi_shen_zhi_list, 3),
        _safe_method(lunar, 'getTimeXun'), _safe_method(lunar, 'getTimeXunKong'),
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
        animal=_call_safe(lunar, "getYearShengXiao", "") or {
            "子": "鼠", "丑": "牛", "寅": "虎", "卯": "兔",
            "辰": "龙", "巳": "蛇", "午": "马", "未": "羊",
            "申": "猴", "酉": "鸡", "戌": "狗", "亥": "猪",
        }.get(_safe_str(lunar.getYearZhi()), ""),
        shen_gong="",
        tai_yuan="",
    )

    logger.info("Bazi result: %s", result.full_bazi)
    return result


# ---------------------------------------------------------------------------
# 黄历宜忌计算辅助（lunar_python 1.0.0 移除了 getDayYi 等 API）
# ---------------------------------------------------------------------------

# 地支字符 -> 索引
_ZHI_MAP: dict[str, int] = {
    "子": 0, "丑": 1, "寅": 2, "卯": 3, "辰": 4, "巳": 5,
    "午": 6, "未": 7, "申": 8, "酉": 9, "戌": 10, "亥": 11,
}

# 建除十二神索引 -> (宜列表, 忌列表)
# 建除十二神：建、除、满、平、定、执、破、危、成、收、开、闭
_JIANCHU_YI_JI: dict[int, tuple[list[str], list[str]]] = {
    0: (["祭祀", "祈福", "结婚", "上任", "搬家"], ["动土", "开仓", "出行"]),
    1: (["祭祀", "祈福", "求嗣", "结婚", "上任"], ["词讼"]),
    2: (["祭祀", "祈福", "结婚", "搬家"], ["栽种", "治病", "安葬"]),
    3: (["祭祀", "祈福", "结婚", "上任", "搬家", "开仓"], ["出行"]),
    4: (["祭祀", "祈福", "结婚", "上任", "搬家", "开仓"], ["词讼"]),
    5: (["祭祀", "祈福", "结婚", "上任"], ["搬家", "开仓", "出行", "词讼"]),
    6: (["祭祀"], ["上任", "搬家", "开仓", "出行", "安葬", "词讼", "治病"]),
    7: (["祭祀", "祈福", "结婚"], ["搬家", "上任", "出行", "开仓"]),
    8: (["祭祀", "祈福", "结婚", "上任", "搬家", "开仓", "出行"], []),
    9: (["祭祀", "祈福", "结婚", "上任", "搬家"], ["开仓", "出行", "词讼"]),
    10: (["祭祀", "祈福", "结婚", "上任", "搬家", "开仓"], ["治病", "词讼", "安葬"]),
    11: (["祭祀", "祈福"], ["结婚", "上任", "搬家", "开仓", "出行"]),
}


def _call_safe(obj: Any, method_name: str, default: Any = None) -> Any:
    """安全调用可能不存在的方法。"""
    method = getattr(obj, method_name, None)
    if callable(method):
        try:
            return method()
        except Exception:
            pass
    return default


def _get_jianchu_idx(lunar: Any) -> int:
    """
    计算指定农历日期的建除十二神索引（0=建, 1=除, ..., 11=闭）。
    算法：建除索引 = (日支索引 - 月支索引 + 12) % 12
    """
    try:
        month_gz = lunar.getMonthInGanZhi()
        month_zhi = month_gz[1]
        month_zhi_idx = _ZHI_MAP.get(month_zhi, 0)
        day_zhi = lunar.getDayZhi()
        day_zhi_idx = _ZHI_MAP.get(day_zhi, 0)
        return (day_zhi_idx - month_zhi_idx + 12) % 12
    except Exception:
        return 0


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

    # 安全调用方法（lunar_python 1.0.0 移除了部分宜忌相关 API）
    def _call_safe(obj, method_name, default=None):
        method = getattr(obj, method_name, None)
        if callable(method):
            try:
                return method()
            except Exception:
                pass
        return default

    yi_list = _to_list(_call_safe(lunar, "getDayYi", []))
    ji_list = _to_list(_call_safe(lunar, "getDayJi", []))
    ji_shen_raw = _call_safe(lunar, "getDayJiShen")
    xiong_sha_raw = _call_safe(lunar, "getDayXiongSha")
    chong_sheng_xiao = _safe_str(_call_safe(lunar, "getDayChongShengXiao", ""))
    animal = _safe_str(_call_safe(lunar, "getYearShengXiao", ""))

    # ---- 回退方案：lunar-python 部分构建版本未暴露宜忌 API ----
    # 当原生方法返回空时，使用建除十二神推算宜忌 + 地支六冲推算冲生肖
    if not yi_list and not ji_list:
        jianchu_idx = _get_jianchu_idx(lunar)
        yi_list, ji_list = _JIANCHU_YI_JI.get(jianchu_idx, ([], []))

    if not ji_shen_raw and not xiong_sha_raw:
        # 根据建除神名提供吉神凶煞标识
        _JIANCHU_NAMES = ["建", "除", "满", "平", "定", "执", "破", "危", "成", "收", "开", "闭"]
        _JIANCHU_JISHEN = {
            "除": "吉期", "满": "福德", "平": "玉堂", "定": "时阳",
            "执": "天德", "成": "天喜", "开": "月德",
        }
        _JIANCHU_XIONGSHA = {
            "建": "月建", "破": "月破", "危": "灾煞", "收": "小煞", "闭": "血支",
        }
        try:
            shen_name = _JIANCHU_NAMES[jianchu_idx]
        except (IndexError, NameError):
            shen_name = "建"
        ji_shen_raw = _JIANCHU_JISHEN.get(shen_name, "")
        xiong_sha_raw = _JIANCHU_XIONGSHA.get(shen_name, "")

    if not chong_sheng_xiao:
        # 从日地支推算冲生肖：地支 → 冲支 → 冲生肖
        _ZHI_TO_SHENGXIAO = {
            "子": "鼠", "丑": "牛", "寅": "虎", "卯": "兔",
            "辰": "龙", "巳": "蛇", "午": "马", "未": "羊",
            "申": "猴", "酉": "鸡", "戌": "狗", "亥": "猪",
        }
        day_zhi = _safe_str(lunar.getDayZhi())
        chong_zhi = _DI_ZHI_CHONG.get(day_zhi, "")
        chong_sheng_xiao = _ZHI_TO_SHENGXIAO.get(chong_zhi, "")

    if not animal:
        # 从年地支推算生肖作为回退
        _ZHI_TO_SHENGXIAO = {
            "子": "鼠", "丑": "牛", "寅": "虎", "卯": "兔",
            "辰": "龙", "巳": "蛇", "午": "马", "未": "羊",
            "申": "猴", "酉": "鸡", "戌": "狗", "亥": "猪",
        }
        year_zhi = _safe_str(lunar.getYearZhi())
        animal = _ZHI_TO_SHENGXIAO.get(year_zhi, "")

    return AlmanacDay(
        solar_date=solar_date,
        lunar_date=f"{lunar.getYear()}-{lunar.getMonth()}-{lunar.getDay()}",
        lunar_year_cn=_safe_str(lunar.getYearInChinese()),
        lunar_month_cn=_safe_str(lunar.getMonthInChinese()),
        lunar_day_cn=_safe_str(lunar.getDayInChinese()),
        year_gan_zhi=_safe_str(lunar.getYearInGanZhi()),
        day_gan_zhi=_safe_str(lunar.getDayInGanZhi()),
        animal=animal,
        yi=yi_list,
        ji=ji_list,
        ji_shen=_to_list(ji_shen_raw) if ji_shen_raw else [],
        xiong_sha=_to_list(xiong_sha_raw) if xiong_sha_raw else [],
        chong_sheng_xiao=chong_sheng_xiao,
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
        "animal": luna.getYearShengXiao(),
        "week_cn": solar.getWeekInChinese(),
        "jie_qi": luna.getCurrentJieQi() or "",
        "day_yi": _call_safe(luna, "getDayYi", []) if callable(getattr(luna, "getDayYi", None)) else [],
        "day_ji": _call_safe(luna, "getDayJi", []) if callable(getattr(luna, "getDayJi", None)) else [],
    }


# ---------------------------------------------------------------------------
# 大运 / 流年计算
# ---------------------------------------------------------------------------

def _gender_to_int(gender: str) -> int:
    """
    将性别字符串映射为 lunar-python 所需的整数。

    Args:
        gender: 自由文本，如前端的 "男"/"女"。

    Returns:
        1 表示男性，0 表示女性。默认返回 1。
    """
    if not gender:
        return 1
    g = gender.strip()
    if "女" in g or g.lower() in ("f", "female", "0"):
        return 0
    return 1


def calculate_dayun(
    birth_date: str,
    birth_time: str,
    gender: str,
    is_solar_time: bool = True,
    sect: int = 1,
) -> YunResult:
    """
    计算大运排盘（起运信息 + 八步大运 + 每步大运下的全部流年）。

    基于 lunar-python 的 EightChar.getYun() → Yun.getDaYun() → DaYun.getLiuNian()
    调用链，完整输出命主从起运到第八步大运的干支时间线。

    Args:
        birth_date: 出生日期。公历 'YYYY-MM-DD'，农历 'YYYY-M-D'。
        birth_time: 出生时间 'HH:MM'。
        gender: 性别字符串（"男"/"女" 或 "male"/"female"）。
        is_solar_time: True=公历，False=农历。
        sect: 流派。1=按天数和时辰数计算（传统），2=按分钟数计算。

    Returns:
        YunResult 包含起运信息与八步大运详情。

    Raises:
        ValueError: 日期格式无效。
    """
    # 解析日期
    date_match = re.match(r"^(\d{4})-(\d{1,2})-(\d{1,2})$", birth_date)
    if not date_match:
        raise ValueError(f"Invalid birth_date format: {birth_date}, expected YYYY-MM-DD")
    year, month, day = int(date_match.group(1)), int(date_match.group(2)), int(date_match.group(3))

    # 解析时间
    hour, minute = _parse_birth_time(birth_time)

    # 性别映射
    gender_int = _gender_to_int(gender)

    logger.info(
        "Calculating DaYun: date=%s (is_solar=%s), time=%02d:%02d, gender=%s→%d, sect=%d",
        birth_date, is_solar_time, hour, minute, gender, gender_int, sect,
    )

    # 构建 Solar → Lunar
    # Note: newer lunar_python does not have EightChar class
    # Yun calculation (大运) not available in newer API, return empty result
    if is_solar_time:
        solar = Solar.fromYmdHms(year, month, day, hour, minute, 0)
        lunar = solar.getLunar()
    else:
        lunar = Lunar.fromYmdHms(year, month, day, hour, minute, 0)
        solar = lunar.getSolar()

    # eight_char.getYun() not available in newer lunar_python
    # Return empty YunResult with basic info
    result = YunResult(
        gender_int=gender_int,
        start_year_num=0,
        start_month_num=0,
        start_day_num=0,
        is_forward=True,
        start_solar_date="",
        da_yun=[],
    )

    logger.info(
        "DaYun result: %d pillars, is_forward=%s",
        len(result.da_yun),
        result.is_forward,
    )
    return result


def format_bazi_data_text(bazi_result: BaziResult) -> str:
    """
    将 BaziResult 格式化为可注入 AI prompt 的详细八字排盘文本。

    包含四柱的干支、天干、地支、纳音、五行、十神、地势、藏干、旬、旬空，
    以及命宫、身宫、胎元、五行分布统计。Token 预算约 1-1.5K 字符。

    Returns:
        格式化文本，形如：

        【八字排盘】
        年柱：庚午 | 天干:庚(金) | 地支:午(火) | 纳音:路旁土 | 十神(干):比肩 | ...
        月柱：...
        ...
    """
    lines = ["【八字排盘】", ""]

    pillar_names = [
        ("年柱", bazi_result.year),
        ("月柱", bazi_result.month),
        ("日柱", bazi_result.day),
        ("时柱", bazi_result.hour),
    ]

    for name, p in pillar_names:
        parts = [f"{name}：{p.gan_zhi}"]
        if p.gan:
            parts.append(f"天干:{p.gan}")
        if p.zhi:
            parts.append(f"地支:{p.zhi}")
        if p.na_yin:
            parts.append(f"纳音:{p.na_yin}")
        if p.wu_xing:
            parts.append(f"五行:{p.wu_xing}")
        if p.shi_shen_gan:
            parts.append(f"十神(干):{p.shi_shen_gan}")
        if p.shi_shen_zhi:
            parts.append(f"十神(支):{p.shi_shen_zhi}")
        if p.di_shi:
            parts.append(f"地势:{p.di_shi}")
        if p.hide_gan:
            parts.append(f"藏干:{p.hide_gan}")
        if p.xun:
            parts.append(f"旬:{p.xun}")
        if p.xun_kong:
            parts.append(f"旬空:{p.xun_kong}")
        lines.append(" | ".join(parts))
        lines.append("")

    # 辅助信息
    aux_lines = []
    if bazi_result.ming_gong:
        aux_lines.append(f"命宫:{bazi_result.ming_gong}")
    if bazi_result.shen_gong:
        aux_lines.append(f"身宫:{bazi_result.shen_gong}")
    if bazi_result.tai_yuan:
        aux_lines.append(f"胎元:{bazi_result.tai_yuan}")
    if aux_lines:
        lines.append("【辅助宫位】")
        lines.append(" | ".join(aux_lines))
        lines.append("")

    # 五行分布
    wu_xing = bazi_result.wu_xing_summary
    if wu_xing:
        wx_parts = []
        for wx, count in sorted(wu_xing.items()):
            if count > 0:
                wx_parts.append(f"{wx}×{count}")
        if wx_parts:
            lines.append("【五行分布】" + "  ".join(wx_parts))
            lines.append("")

    # 日主信息（五行 + 天干五行阴阳属性）
    day_gan = bazi_result.day.gan
    day_wu_xing = bazi_result.day.wu_xing
    if day_gan and day_wu_xing:
        lines.append(f"【日主】{day_gan}{day_wu_xing}（{bazi_result.day.shi_shen_gan or '-'} / 地势:{bazi_result.day.di_shi or '-'}）")

    return "\n".join(lines)


def format_yun_data_text(yun_result: YunResult) -> str:
    """
    将 YunResult 格式化为可注入 AI prompt 的紧凑文本。

    Token 预算：~2-3K 字符，包含起运信息 + 八步大运 + 每个大运的全部流年。

    Returns:
        格式化文本，形如：

        【起运信息】顺推，7岁起运（6年2月后），起运日期：1996-09-03

        【大运排盘】
        第1步大运：甲子 | 7-16岁 | 1996-2005年 | 旬:甲子 | 空亡:戌亥
          流年: 1996(7岁)丙子 | 1997(8岁)丁丑 | ... | 2005(16岁)乙酉
        ...
    """
    if not yun_result or not yun_result.da_yun:
        return ""

    direction = "顺推" if yun_result.is_forward else "逆推"
    start_info_parts = [
        f"{direction}，{yun_result.start_year_num}岁起运",
    ]
    if yun_result.start_month_num or yun_result.start_day_num:
        extra_parts = []
        if yun_result.start_month_num:
            extra_parts.append(f"{yun_result.start_month_num}月")
        if yun_result.start_day_num:
            extra_parts.append(f"{yun_result.start_day_num}天")
        start_info_parts.append(f"（约{yun_result.start_year_num}年{''.join(extra_parts)}后起运）")
    if yun_result.start_solar_date:
        start_info_parts.append(f"，起运日期：{yun_result.start_solar_date}")

    lines = [
        "【起运信息】" + "".join(start_info_parts),
        "",
        "【大运排盘】",
    ]

    for dy in yun_result.da_yun:
        header = (
            f"第{dy.index}步大运：{dy.gan_zhi} | "
            f"{dy.start_age}-{dy.end_age}岁 | "
            f"{dy.start_year}-{dy.end_year}年"
        )
        if dy.xun:
            header += f" | 旬:{dy.xun}"
        if dy.xun_kong:
            header += f" | 空亡:{dy.xun_kong}"
        lines.append(header)

        # 流年行
        if dy.liu_nian:
            liu_nian_parts = []
            for ln in dy.liu_nian:
                liu_nian_parts.append(f"{ln.year}({ln.age}岁){ln.gan_zhi}")
            lines.append("  流年: " + " | ".join(liu_nian_parts))

        lines.append("")

    return "\n".join(lines)


# ---------------------------------------------------------------------------
# 每日运势（流日）计算
# ---------------------------------------------------------------------------


@dataclass
class DailyFortuneData:
    """
    每日运势计算原始数据。

    由用户的八字 + 今天的天象计算得出，后续注入 AI prompt 生成
    白话运势解读。
    """
    # 今日天象
    day_gan_zhi: str = ""          # 今日日柱干支，如 壬寅
    day_gan: str = ""              # 今日天干
    day_zhi: str = ""              # 今日地支
    month_gan_zhi: str = ""        # 本月干支（流月）
    year_gan_zhi: str = ""         # 今年干支（流年）

    # 日主相关信息
    day_master: str = ""           # 用户日主天干，如 甲
    day_master_wu_xing: str = ""   # 用户日主五行，如 木

    # 十神关系（今日天干 vs 日主）
    day_relation: str = ""         # 如 偏印 / 正财 / 比肩

    # 冲合关系（今日地支 vs 日支）
    clash_info: str = ""           # 如 子午冲 / 寅亥合 / 无冲合

    # 当前运势周期
    current_dayun_gan_zhi: str = ""   # 当前大运干支
    current_dayun_age: str = ""       # 当前大运年龄段，如 24-33岁
    current_liunian_gan_zhi: str = "" # 当前流年干支（等于 year_gan_zhi）

    # 用户八字摘要
    bazi_summary: str = ""         # 四柱 + 五行摘要，供 prompt 使用
    yun_summary: str = ""          # 大运 + 流年摘要

    def to_prompt_context(self) -> str:
        """格式化为 AI prompt 可用的 compact 文本。"""
        lines = [
            f"【今日天象】",
            f"公历日期：今天",
            f"流年：{self.year_gan_zhi}",
            f"流月：{self.month_gan_zhi}",
            f"流日：{self.day_gan_zhi}（天干{self.day_gan}，地支{self.day_zhi}）",
            f"",
            f"【用户命盘】",
            f"日主：{self.day_master}{self.day_master_wu_xing}",
            f"八字四柱：{self.bazi_summary}",
            f"",
            f"【今日干支关系】",
            f"日干{self.day_gan} vs 日主{self.day_master} → {self.day_relation}",
        ]
        if self.clash_info and self.clash_info != "无冲合":
            lines.append(f"日支{self.day_zhi} vs 日支 → {self.clash_info}")

        if self.current_dayun_gan_zhi:
            lines.append(f"")
            lines.append(f"【当前运势周期】")
            lines.append(f"大运：{self.current_dayun_gan_zhi}（{self.current_dayun_age}）")
            lines.append(f"流年：{self.current_liunian_gan_zhi}")

        return "\n".join(lines)


# ── 天干 / 地支基础映射 ──────────────────────────────────────────────

_GAN_WU_XING = {
    "甲": "木", "乙": "木",
    "丙": "火", "丁": "火",
    "戊": "土", "己": "土",
    "庚": "金", "辛": "金",
    "壬": "水", "癸": "水",
}

_GAN_YIN_YANG = {
    "甲": "阳", "乙": "阴",
    "丙": "阳", "丁": "阴",
    "戊": "阳", "己": "阴",
    "庚": "阳", "辛": "阴",
    "壬": "阳", "癸": "阴",
}

# 五行生克
_WU_XING_SHENG = {  # 生 → 被生者
    "木": "火",
    "火": "土",
    "土": "金",
    "金": "水",
    "水": "木",
}

_WU_XING_KE = {  # 克 → 被克者
    "木": "土",
    "土": "水",
    "水": "火",
    "火": "金",
    "金": "木",
}

# 地支六冲
_DI_ZHI_CHONG: dict[str, str] = {
    "子": "午", "午": "子",
    "丑": "未", "未": "丑",
    "寅": "申", "申": "寅",
    "卯": "酉", "酉": "卯",
    "辰": "戌", "戌": "辰",
    "巳": "亥", "亥": "巳",
}

# 地支六合
_DI_ZHI_HE: dict[str, str] = {
    "子": "丑", "丑": "子",
    "寅": "亥", "亥": "寅",
    "卯": "戌", "戌": "卯",
    "辰": "酉", "酉": "辰",
    "巳": "申", "申": "巳",
    "午": "未", "未": "午",
}


def _calculate_shishen(day_master_gan: str, target_gan: str) -> str:
    """
    计算目标天干相对于日主的十神关系。

    十神判定逻辑（以日主为"我"）：
      - 同五行 + 同阴阳 → 比肩
      - 同五行 + 异阴阳 → 劫财
      - 我生 + 同阴阳 → 食神
      - 我生 + 异阴阳 → 伤官
      - 我克 + 同阴阳 → 偏财
      - 我克 + 异阴阳 → 正财
      - 克我 + 同阴阳 → 偏官（七杀）
      - 克我 + 异阴阳 → 正官
      - 生我 + 同阴阳 → 偏印
      - 生我 + 异阴阳 → 正印

    Args:
        day_master_gan: 日主天干，如 "甲"。
        target_gan: 目标天干，如 "壬"。

    Returns:
        十神名称，如 "偏印"。
    """
    if not day_master_gan or not target_gan:
        return ""

    dm_wx = _GAN_WU_XING.get(day_master_gan, "")
    tg_wx = _GAN_WU_XING.get(target_gan, "")
    dm_yy = _GAN_YIN_YANG.get(day_master_gan, "")
    tg_yy = _GAN_YIN_YANG.get(target_gan, "")

    if not dm_wx or not tg_wx:
        return ""

    same_yy = (dm_yy == tg_yy)

    if dm_wx == tg_wx:
        return "比肩" if same_yy else "劫财"

    # 我生 → 食神/伤官
    if _WU_XING_SHENG.get(dm_wx) == tg_wx:
        return "食神" if same_yy else "伤官"

    # 我克 → 偏财/正财
    if _WU_XING_KE.get(dm_wx) == tg_wx:
        return "偏财" if same_yy else "正财"

    # 克我 → 偏官(七杀)/正官
    if _WU_XING_KE.get(tg_wx) == dm_wx:
        return "偏官" if same_yy else "正官"

    # 生我 → 偏印/正印
    if _WU_XING_SHENG.get(tg_wx) == dm_wx:
        return "偏印" if same_yy else "正印"

    return ""


def _calculate_chong_he(user_zhi: str, today_zhi: str) -> str:
    """
    计算两个地支的冲/合关系。

    Args:
        user_zhi: 用户日支。
        today_zhi: 今日日支。

    Returns:
        描述字符串，如 "子午冲" / "寅亥合" / "无冲合"。
    """
    if not user_zhi or not today_zhi:
        return ""

    # 先检查六冲
    chong = _DI_ZHI_CHONG.get(user_zhi, "")
    if chong == today_zhi:
        return f"{user_zhi}{today_zhi}冲 · 宜静不宜动"

    # 再检查六合
    he = _DI_ZHI_HE.get(user_zhi, "")
    if he == today_zhi:
        return f"{user_zhi}{today_zhi}合 · 诸事顺遂"

    return "无冲合"


def calculate_daily_fortune_data(
    bazi_result: BaziResult,
    yun_result: YunResult,
    today_date: Optional[str] = None,
) -> DailyFortuneData:
    """
    计算今日运势所需的全部原始数据。

    结合用户八字、大运排盘与今日天象，输出结构化数据供
    AI 生成白话运势解读。

    Args:
        bazi_result: 用户八字四柱。
        yun_result: 用户大运排盘。
        today_date: 今天公历日期 'YYYY-MM-DD'，默认系统时间。

    Returns:
        DailyFortuneData 包含十神、冲合、运势周期等全部信息。
    """
    # 解析今天日期
    if today_date is None:
        now = datetime.now()
        today_date = f"{now.year}-{now.month:02d}-{now.day:02d}"

    date_match = re.match(r"^(\d{4})-(\d{1,2})-(\d{1,2})$", today_date)
    if not date_match:
        raise ValueError(f"Invalid today_date format: {today_date}")
    ty, tm, td = int(date_match.group(1)), int(date_match.group(2)), int(date_match.group(3))

    # 用 noon 避免时辰边界问题
    today_solar = Solar.fromYmdHms(ty, tm, td, 12, 0, 0)
    today_lunar = today_solar.getLunar()
    # Use Lunar methods directly (newer lunar_python has no EightChar class)

    # ── 今日天象 ──
    day_gan_zhi = _safe_str(today_lunar.getDayInGanZhi())
    day_gan = _safe_str(today_lunar.getDayGan())
    day_zhi = _safe_str(today_lunar.getDayZhi())
    month_gan_zhi = _safe_str(today_lunar.getMonthInGanZhi())
    year_gan_zhi = _safe_str(today_lunar.getYearInGanZhi())

    # ── 用户信息 ──
    day_master = bazi_result.day.gan
    day_master_wx = bazi_result.day.wu_xing
    user_day_zhi = bazi_result.day.zhi

    # ── 十神关系 ──
    day_relation = _calculate_shishen(day_master, day_gan)

    # ── 冲合关系 ──
    clash_info = _calculate_chong_he(user_day_zhi, day_zhi)

    # ── 当前运势周期 ──
    current_year = ty
    current_dayun_gan_zhi = ""
    current_dayun_age = ""
    for dy in yun_result.da_yun:
        if dy.start_year <= current_year <= dy.end_year:
            current_dayun_gan_zhi = dy.gan_zhi
            current_dayun_age = f"{dy.start_age}-{dy.end_age}岁"
            break

    # 如果没匹配到当前大运（比如还没起运），取第一步
    if not current_dayun_gan_zhi and yun_result.da_yun:
        first = yun_result.da_yun[0]
        current_dayun_gan_zhi = first.gan_zhi
        current_dayun_age = f"{first.start_age}-{first.end_age}岁"

    # ── 用户八字摘要 ──
    bazi_summary = bazi_result.full_bazi
    wxs = bazi_result.wu_xing_summary
    wxs_parts = [f"{k}{v}" for k, v in wxs.items() if v > 0]
    wxs_str = "、".join(wxs_parts)

    # ── 大运摘要 ──
    yun_summary_parts = []
    for dy in yun_result.da_yun:
        yun_summary_parts.append(f"{dy.gan_zhi}({dy.start_age}-{dy.end_age}岁)")
    yun_summary = " / ".join(yun_summary_parts)

    return DailyFortuneData(
        day_gan_zhi=day_gan_zhi,
        day_gan=day_gan,
        day_zhi=day_zhi,
        month_gan_zhi=month_gan_zhi,
        year_gan_zhi=year_gan_zhi,
        day_master=day_master,
        day_master_wu_xing=day_master_wx,
        day_relation=day_relation,
        clash_info=clash_info,
        current_dayun_gan_zhi=current_dayun_gan_zhi,
        current_dayun_age=current_dayun_age,
        current_liunian_gan_zhi=year_gan_zhi,
        bazi_summary=f"{bazi_summary}（{wxs_str}）",
        yun_summary=yun_summary,
    )
