"""Deterministic hexagrams and versioned, locally sourced Zhouyi evidence.

This module never calls an AI provider or the network. The client's line values
are checked; hexagram names, changing lines and quotations are rebuilt locally.
Advanced 纳甲 judgments, 用神 and 应期 are deliberately outside this core.
"""
from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timedelta, timezone
from functools import lru_cache
from importlib.metadata import version as package_version
import json
import math
from pathlib import Path
import re
from typing import Any

from lunar_python import Solar

FACTS_VERSION = "zhouyi-reading-facts-v1"
CORPUS_PATH = Path(__file__).resolve().parents[1] / "data" / "zhouyi_corpus.json"
RULE_VERSIONS = {
    "liuyao-manual": "divination-v1",
    "liuyao-najia": "liuyao-najia-v1",
    "liuyao-coins": "liuyao-coins-v1",
    "meihua-two-numbers": "divination-v1",
    "meihua-calendar": "meihua-calendar-v1",
}
_CONTEXT_FIELDS = {"question", "date", "time", "utcOffset", "method"}
_HEXAGRAM_FIELDS = ("number", "name", "symbol", "lower", "upper", "lines")


@lru_cache(maxsize=1)
def _corpus() -> dict:
    corpus = json.loads(CORPUS_PATH.read_text(encoding="utf-8"))
    entries = corpus.get("hexagrams", [])
    if len(entries) != 64 or [e["number"] for e in entries] != list(range(1, 65)):
        raise ValueError("周易经文资料不完整，暂时无法生成解读证据。")
    if any(len(e["lineTexts"]) != 6 for e in entries):
        raise ValueError("周易爻辞资料不完整。")
    return corpus


def _number(value: Any) -> bool:
    # Python bool is an int subclass; never accept it as a numeric field.
    return type(value) is int or (type(value) is float and math.isfinite(value))


def _integer(value: Any) -> bool:
    return _number(value) and int(value) == value


def _validate(input_data: dict, rule_version: str) -> tuple[dict, datetime, datetime]:
    if not isinstance(input_data, dict):
        raise ValueError("起卦资料格式不正确。")
    value = deepcopy(input_data)
    method = value.get("method")
    if not isinstance(method, str) or method not in RULE_VERSIONS:
        raise ValueError("未知的起卦方式。")
    if rule_version != RULE_VERSIONS[method]:
        raise ValueError("起卦方法与规则版本不匹配。")
    extra_fields = {"lines", "coins"} if method == "liuyao-coins" else {"lines"} if method in ("liuyao-manual", "liuyao-najia") else {"numbers"} if method == "meihua-two-numbers" else set()
    if set(value) != _CONTEXT_FIELDS | extra_fields:
        raise ValueError("起卦资料包含缺失或不支持的字段。")
    question = value.get("question")
    if not isinstance(question, str) or not question.strip() or len(question.strip().encode("utf-16-le")) // 2 > 200:
        raise ValueError("请填写 1 至 200 字的记录问题。")
    value["question"] = question.strip()
    date = value.get("date")
    if not isinstance(date, str) or not re.fullmatch(r"[0-9]{4}-[0-9]{2}-[0-9]{2}", date) or not "1900-01-01" <= date <= "2099-12-31":
        raise ValueError("请选择 1900 至 2099 年之间的有效问事日期。")
    time = value.get("time")
    if not isinstance(time, str) or not re.fullmatch(r"(?:[01][0-9]|2[0-3]):[0-5][0-9]", time):
        raise ValueError("请选择有效的问事时间。")
    offset = value.get("utcOffset")
    if not _number(offset) or not -12 <= offset <= 14 or int(offset * 4) != offset * 4:
        raise ValueError("UTC 偏移须为 −12 至 +14 之间、以 15 分钟为单位的数值。")
    try:
        local = datetime.fromisoformat(date + "T" + time + ":00").replace(tzinfo=timezone.utc)
    except ValueError as exc:
        raise ValueError("问事日期不存在，请核对年月日。") from exc
    instant = local - timedelta(hours=offset)
    beijing = instant + timedelta(hours=8)
    if method in ("liuyao-najia", "liuyao-coins", "meihua-calendar") and any(not 1900 <= date.year <= 2099 for date in (instant, beijing)):
        raise ValueError("转换后的 UTC 瞬间和北京时间须在 1900 至 2099 年之间。")
    if "lines" in extra_fields:
        lines = value.get("lines")
        if not isinstance(lines, list) or len(lines) != 6 or any(not _integer(n) or n not in (6, 7, 8, 9) for n in lines):
            raise ValueError("请自下而上填写六个爻值，每爻只能为 6、7、8 或 9。")
        value["lines"] = [int(n) for n in lines]
    if method == "liuyao-coins":
        coins = value.get("coins")
        if not isinstance(coins, list) or len(coins) != 6 or any(not isinstance(row, list) or len(row) != 3 or any(not _integer(n) or n not in (2, 3) for n in row) for row in coins):
            raise ValueError("三钱模拟须保存六组各三个币值，字面为 2、背面为 3。")
        if any(sum(row) != line for row, line in zip(coins, value["lines"])):
            raise ValueError("三钱原始币值与爻值不一致。")
        value["coins"] = [[int(n) for n in row] for row in coins]
    if method == "meihua-two-numbers":
        numbers = value.get("numbers")
        if not isinstance(numbers, list) or len(numbers) != 2 or any(not _integer(n) or not 1 <= n <= 999999 for n in numbers):
            raise ValueError("两数均须为 1 至 999999 的整数。")
        value["numbers"] = [int(n) for n in numbers]
    return value, instant, beijing


def _hexagram(lines: list[int]) -> dict:
    for entry in _corpus()["hexagrams"]:
        if entry["lines"] == lines:
            return {key: deepcopy(entry[key]) for key in _HEXAGRAM_FIELDS}
    raise ValueError("卦象须包含自下而上的六个阴阳爻。")


def _trigrams() -> dict[int, dict]:
    return {entry["lower"]["number"]: entry["lower"] for entry in _corpus()["hexagrams"]}


def _element_relation(body: str, use: str) -> str:
    generates = {"金": "水", "水": "木", "木": "火", "火": "土", "土": "金"}
    controls = {"金": "木", "木": "土", "土": "水", "水": "火", "火": "金"}
    if body == use:
        return "体用比和"
    if generates[body] == use:
        return "体生用"
    if generates[use] == body:
        return "用生体"
    return "体克用" if controls[body] == use else "用克体"


def _calendar(beijing: datetime) -> dict:
    lunar = Solar.fromYmdHms(beijing.year, beijing.month, beijing.day, beijing.hour, beijing.minute, 0).getLunar()
    year, month, day, time = lunar.getYearZhiIndex() + 1, abs(lunar.getMonth()), lunar.getDay(), lunar.getTimeZhiIndex() + 1
    upper_sum = year + month + day
    total = upper_sum + time
    return {
        "engine": {"name": "lunar-python", "version": package_version("lunar-python")},
        "beijingTime": beijing.strftime("%Y-%m-%d %H:%M") + " UTC+08:00",
        "lunar": {"year": lunar.getYear(), "yearBranch": lunar.getYearZhi(), "month": month, "day": day, "isLeapMonth": lunar.getMonth() < 0, "label": f"{lunar.getYearInGanZhi()}年{lunar.getMonthInChinese()}月{lunar.getDayInChinese()}"},
        "timeBranch": lunar.getTimeZhi(), "numbers": {"year": year, "month": month, "day": day, "time": time},
        "upperSum": upper_sum, "total": total, "upperNumber": upper_sum % 8 or 8, "lowerNumber": total % 8 or 8, "movingLine": total % 6 or 6,
        "rules": {"timeBasis": "fixed-utc8", "yearBoundary": "lunar-new-year", "dayBoundary": "midnight", "leapMonthPolicy": "same-number", "mutualPolicy": "original-structure", "bodyUsePolicy": "moving-trigram-is-use"},
    }


def _evidence(number: int, passage: dict, suffix: str) -> dict:
    entry = _corpus()["hexagrams"][number - 1]
    evidence = {
        "id": f"zhouyi.{number}.{suffix}", "title": f"{entry['name']} · {passage['title']}",
        "text": passage["text"], "sourceTitle": entry["source"]["title"], "url": entry["source"]["url"], "hexagramNumber": number,
    }
    if "position" in passage:
        evidence["linePosition"] = passage["position"]
    return evidence


def build_divination_facts(input_data: dict, rule_version: str) -> dict:
    """Validate one persisted cast and rebuild its independent reading facts.

    Raises ValueError for unsupported versions, invalid dates, malformed or
    inconsistent casts. The original input is never mutated or randomized.
    """
    value, instant, beijing = _validate(input_data, rule_version)
    method = value["method"]
    calendar = None
    if method in ("liuyao-manual", "liuyao-najia", "liuyao-coins"):
        lines = [1 if n in (7, 9) else 0 for n in value["lines"]]
        moving = [i + 1 for i, n in enumerate(value["lines"]) if n in (6, 9)]
    else:
        if method == "meihua-two-numbers":
            first, second = value["numbers"]
            upper, lower, moving = first % 8 or 8, second % 8 or 8, [(first + second) % 6 or 6]
        else:
            calendar = _calendar(beijing)
            upper, lower, moving = calendar["upperNumber"], calendar["lowerNumber"], [calendar["movingLine"]]
        trigrams = _trigrams()
        lines = trigrams[lower]["lines"] + trigrams[upper]["lines"]
    original = _hexagram(lines)
    changed = _hexagram([1 - line if i + 1 in moving else line for i, line in enumerate(lines)])
    corpus = _corpus()
    entry = corpus["hexagrams"][original["number"] - 1]
    evidence = [_evidence(original["number"], entry["judgment"], "judgment")]
    evidence.extend(_evidence(original["number"], entry["lineTexts"][position - 1], f"line.{position}") for position in moving)
    if len(moving) == 6 and original["number"] in (1, 2):
        evidence.append(_evidence(original["number"], entry["specialTexts"][0], "use-nine" if original["number"] == 1 else "use-six"))
    if changed["number"] != original["number"]:
        evidence.append(_evidence(changed["number"], corpus["hexagrams"][changed["number"] - 1]["judgment"], "judgment"))
    scope = [
        "本次仅解读程序复算的本卦、动爻、之卦及所列《周易》经文；原文与AI解释分别展示。",
        "动爻自下而上编号；全部动爻并读，不采用未声明的多动择辞规则。" if moving else "本次无动爻，本卦与之卦相同；以本卦卦辞为阅读依据。",
        "之卦作为变化的参考，不作为未来事件必然发生的结论。",
        "不自动推用神、旺衰或应期；解释不证明现实预测准确性。",
    ]
    if len(moving) == 6 and original["number"] in (1, 2):
        scope.append("乾或坤六爻全动，附列用九或用六，与六条动爻并读。")
    facts = {"version": FACTS_VERSION, "ruleVersion": rule_version, "questionInstant": instant.isoformat(timespec="milliseconds").replace("+00:00", "Z"), "original": original, "changed": changed, "movingLines": moving, "evidence": evidence, "sourceVersion": corpus["sourceVersion"], "readingScope": scope}
    facts["sourceLicense"] = {"license": corpus["license"], "url": corpus["licenseUrl"],
                              "attribution": corpus["attribution"], "changes": corpus["changes"]}
    if method.startswith("meihua-"):
        facts["mutual"] = _hexagram([lines[1], lines[2], lines[3], lines[2], lines[3], lines[4]])
        lower_moves = moving[0] <= 3
        body, use = (original["upper"], original["lower"]) if lower_moves else (original["lower"], original["upper"])
        facts["bodyUse"] = {"body": deepcopy(body), "use": deepcopy(use), "bodyPosition": "上卦" if lower_moves else "下卦", "usePosition": "下卦" if lower_moves else "上卦", "relation": _element_relation(body["element"], use["element"])}
        scope.append("梅花互卦与体用由本卦结构复算；本次经文依据仍为本卦、动爻和之卦。")
    if calendar:
        facts["calendar"] = calendar
    return facts
