"""Build the licensed Zhouyi corpus from pinned Wikisource revisions.

Default: rebuild offline from the checked-in raw revision snapshot.
--fetch: fetch exactly the manifest's revision IDs and verify their SHA-256.
--refresh: explicitly select current revisions and replace the source manifest.
No modern translation, 彖, 象, or 文言 is included in the reading corpus.
"""
from __future__ import annotations

import argparse
import hashlib
import html
import json
import re
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "app" / "data"
SNAPSHOT = DATA / "zhouyi_wikisource_revisions.json"
OUTPUT = DATA / "zhouyi_corpus.json"
EXTRACTOR_VERSION = "zhouyi-wikitext-extractor-v1"
SOURCE_VERSION = "zhouyi-wikisource-2026-10-03-v1"
TRADITIONAL_NAMES = "乾 坤 屯 蒙 需 訟 師 比 小畜 履 泰 否 同人 大有 謙 豫 隨 蠱 臨 觀 噬嗑 賁 剝 復 无妄 大畜 頤 大過 坎 離 咸 恒 遯 大壯 晉 明夷 家人 睽 蹇 解 損 益 夬 姤 萃 升 困 井 革 鼎 震 艮 漸 歸妹 豐 旅 巽 兌 渙 節 中孚 小過 既濟 未濟".split()
NAMES = "乾 坤 屯 蒙 需 讼 师 比 小畜 履 泰 否 同人 大有 谦 豫 随 蛊 临 观 噬嗑 贲 剥 复 无妄 大畜 颐 大过 坎 离 咸 恒 遁 大壮 晋 明夷 家人 睽 蹇 解 损 益 夬 姤 萃 升 困 井 革 鼎 震 艮 渐 归妹 丰 旅 巽 兑 涣 节 中孚 小过 既济 未济".split()
TRIGRAMS = [
    {"number": i + 1, "name": name, "image": image, "element": element, "lines": [int(n) for n in bits]}
    for i, (name, image, element, bits) in enumerate([
        ("乾", "天", "金", "111"), ("兑", "泽", "金", "110"),
        ("离", "火", "火", "101"), ("震", "雷", "木", "100"),
        ("巽", "风", "木", "011"), ("坎", "水", "水", "010"),
        ("艮", "山", "土", "001"), ("坤", "地", "土", "000"),
    ])
]
# [lower, upper], checked against the existing frontend's King Wen table.
PAIRS = [
    (1,1),(8,8),(4,6),(6,7),(1,6),(6,1),(6,8),(8,6),
    (1,5),(2,1),(1,8),(8,1),(3,1),(1,3),(7,8),(8,4),
    (4,2),(5,7),(2,8),(8,5),(4,3),(3,7),(8,7),(4,8),
    (4,1),(1,7),(4,7),(5,2),(6,6),(3,3),(7,2),(5,4),
    (7,1),(1,4),(8,3),(3,8),(3,5),(2,3),(7,6),(6,4),
    (2,7),(4,5),(1,2),(5,1),(8,2),(5,8),(6,2),(5,6),
    (3,2),(5,3),(4,4),(7,7),(7,5),(2,4),(3,4),(7,3),
    (5,5),(2,2),(6,5),(2,6),(2,5),(7,4),(3,6),(6,3),
]


def digest(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def api_query(params: dict) -> dict:
    query = {"action": "query", "prop": "revisions", "rvprop": "ids|timestamp|content", "rvslots": "main", "format": "json", "formatversion": 2, **params}
    url = "https://zh.wikisource.org/w/api.php?" + urllib.parse.urlencode(query)
    request = urllib.request.Request(url, headers={"User-Agent": "OasisZhouyiCorpus/1.0 (public-domain classical text; reproducible revision capture)"})
    with urllib.request.urlopen(request, timeout=40) as response:
        result = json.load(response)
    if "error" in result:
        raise ValueError(result["error"])
    return result


def fetch_snapshot(previous: dict | None, source_version: str = SOURCE_VERSION) -> dict:
    pages = []
    fetched = datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")
    for start in range(0, 64, 32):
        params = ({"revids": "|".join(str(p["revisionId"]) for p in previous["pages"][start:start+32])}
                  if previous else {"titles": "|".join("周易/" + n for n in TRADITIONAL_NAMES[start:start+32]), "redirects": 1})
        result = api_query(params)
        for page in result["query"]["pages"]:
            if "missing" in page or not page.get("revisions"):
                raise ValueError(f"Missing source: {page}")
            revision = page["revisions"][0]
            raw = revision["slots"]["main"]["content"]
            pages.append({"title": page["title"], "revisionId": revision["revid"], "revisionTimestamp": revision["timestamp"], "sha256": digest(raw), "wikitext": raw})
    # Known aliases resolve to one canonical Wikisource page, without changing quote text.
    aliases = {"周易/恆": "周易/恒", "周易/遁": "周易/遯", "周易/無妄": "周易/无妄"}
    by_title = {aliases.get(p["title"], p["title"]): p for p in pages}
    ordered = [by_title["周易/" + name] for name in TRADITIONAL_NAMES]
    if previous:
        for old, new in zip(previous["pages"], ordered):
            if (old["revisionId"], old["sha256"]) != (new["revisionId"], new["sha256"]):
                raise ValueError("A pinned source revision failed its content hash")
        return previous  # Preserve capture date and exact offline rebuild bytes.
    return {"sourceVersion": source_version, "fetchedAt": fetched, "license": "CC-BY-SA-4.0", "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0/", "attribution": "《周易》古代原文；维基文库贡献者转录与标点。固定修订及历史链接见各页。", "pages": ordered}


def clean_text(raw: str) -> tuple[str, list[dict]]:
    variants = []

    def variant(match):
        primary, alternative = match.group(1), match.group(2)
        variants.append({"primary": primary, "alternative": alternative})
        return primary

    text = re.sub(r"\{\{另\|([^{}|]+)\|([^{}|]+)\}\}", variant, raw)
    # Other footnotes are retained as notes, never blended into the quoted text.
    def note(match):
        variants.append({"note": match.group(1)})
        return ""
    text = re.sub(r"\{\{\*\|([^{}]+)\}\}", note, text)
    text = re.sub(r"-\{([^{}]+)\}-", r"\1", text)
    text = re.sub(r"\[\[(?:[^\]|]+\|)?([^\]]+)\]\]", r"\1", text)
    text = re.sub(r"<[^>]+>", "", text)
    text = text.replace("'''", "").replace("''", "")
    text = html.unescape(text)
    text = re.sub(r"\s+", "", text)
    if any(marker in text for marker in ("{{", "}}", "[[", "]]", "-{", "}-")):
        raise ValueError(f"Unrecognized wikitext in quoted passage: {text}")
    return text, variants


def extract_page(page: dict, number: int) -> dict:
    raw = page["wikitext"]
    if digest(raw) != page["sha256"]:
        raise ValueError(f"Raw revision hash mismatch: {page['title']}")
    # HTML tags may wrap across lines (notably 坤's section heading).
    flattened = re.sub(r"<[^>]+>", "", raw)
    match = re.search(r"^\*[^\n]*易經[^\n]*\n(.*?)(?=^\*[^\n]*彖曰)", flattened, re.M | re.S)
    if not match:
        raise ValueError(f"Cannot isolate 易經 section: {page['title']}")
    section = match.group(1)
    judgment_parts, lines, specials = [], [], []
    for row in section.splitlines():
        row = row.strip()
        if not row:
            continue
        if not row.startswith("*"):
            raise ValueError(f"Unexpected section row: {page['title']}: {row}")
        is_line = row.startswith("*#")
        text, variants = clean_text(re.sub(r"^[*#:]+", "", row))
        if not text:
            continue
        if is_line:
            parsed = re.fullmatch(r"(初[六九]|上[六九]|[六九][二三四五]|用[六九])[：，](.+)", text)
            if not parsed:
                raise ValueError(f"Invalid line passage: {text}")
            title, body = parsed.groups()
            passage = {"title": title, "text": body}
            if variants:
                passage["variants"] = variants
            if title in ("用九", "用六"):
                specials.append(passage)
            else:
                position = len(lines) + 1
                passage["position"] = position
                lines.append(passage)
        else:
            if lines or variants:
                raise ValueError(f"Unexpected judgment continuation/variant: {page['title']}: {text}")
            judgment_parts.append(text)
    judgment = "".join(judgment_parts)
    _, sep, judgment_text = judgment.partition("：")
    if not sep:
        # 履虎尾 / 否之匪人 / 同人于野: the name is part of the sentence.
        # Do not strip that meaningful word merely because it is bold in HTML.
        if not judgment.startswith(TRADITIONAL_NAMES[number - 1]):
            raise ValueError(f"Unexpected judgment opening: {page['title']}")
        judgment_text = judgment
    lower_num, upper_num = PAIRS[number - 1]
    lower, upper = TRIGRAMS[lower_num - 1], TRIGRAMS[upper_num - 1]
    bits = lower["lines"] + upper["lines"]
    if len(lines) != 6:
        raise ValueError(f"Expected six lines: {page['title']}")
    for position, (passage, bit) in enumerate(zip(lines, bits), 1):
        digit = "九" if bit else "六"
        expected = "初" + digit if position == 1 else "上" + digit if position == 6 else digit + "二三四五"[position - 2]
        if passage["title"] != expected:
            raise ValueError(f"Line heading/polarity mismatch: {page['title']} #{position}: {passage['title']} != {expected}")
    expected_specials = ["用九"] if number == 1 else ["用六"] if number == 2 else []
    if [p["title"] for p in specials] != expected_specials:
        raise ValueError(f"Unexpected special passages: {page['title']}")
    source_url = "https://zh.wikisource.org/w/index.php?" + urllib.parse.urlencode({"title": page["title"], "oldid": page["revisionId"]})
    return {
        "number": number, "name": NAMES[number-1], "sourceName": TRADITIONAL_NAMES[number-1],
        "symbol": chr(0x4DC0+number-1), "lower": lower, "upper": upper, "lines": bits,
        "judgment": {"title": "卦辞", "text": judgment_text}, "lineTexts": lines, "specialTexts": specials,
        "source": {"title": "维基文库《周易·" + TRADITIONAL_NAMES[number-1] + "》", "pageTitle": page["title"], "url": source_url, "historyUrl": "https://zh.wikisource.org/w/index.php?" + urllib.parse.urlencode({"title": page["title"], "action": "history"}), "revisionId": page["revisionId"], "revisionTimestamp": page["revisionTimestamp"], "rawSha256": page["sha256"]},
    }


def build(snapshot: dict) -> dict:
    if len(snapshot["pages"]) != 64:
        raise ValueError("Exactly 64 source pages required")
    entries = [extract_page(page, index + 1) for index, page in enumerate(snapshot["pages"])]
    if len({tuple(e["lines"]) for e in entries}) != 64:
        raise ValueError("Duplicate hexagram polarity")
    return {"sourceVersion": snapshot["sourceVersion"], "extractorVersion": EXTRACTOR_VERSION, "fetchedAt": snapshot["fetchedAt"], "license": snapshot["license"], "licenseUrl": snapshot["licenseUrl"], "attribution": snapshot["attribution"], "changes": "提取易經中的卦辞、六爻爻辞及用九/用六；移除网页及Wiki标记，合并跨段卦辞；异文和校注单列；保留原文用字与标点，不含现代译文、彖象文言。卦名展示采用本项目既有简体名称。", "hexagrams": entries}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--fetch", action="store_true")
    mode.add_argument("--refresh", action="store_true")
    parser.add_argument("--source-version", help="A new explicit corpus version when refreshing changed sources")
    args = parser.parse_args()
    if args.source_version and not args.refresh:
        parser.error("--source-version requires --refresh")
    previous = json.loads(SNAPSHOT.read_text(encoding="utf-8")) if SNAPSHOT.exists() else None
    if args.refresh:
        snapshot = fetch_snapshot(None, args.source_version or SOURCE_VERSION)
        if previous and snapshot["sourceVersion"] == previous["sourceVersion"] and [(p["revisionId"], p["sha256"]) for p in snapshot["pages"]] != [(p["revisionId"], p["sha256"]) for p in previous["pages"]]:
            parser.error("Sources changed: provide a new --source-version; never silently replace an existing corpus version")
    elif args.fetch:
        if not previous:
            parser.error("--fetch requires an existing pinned snapshot; use --refresh for initial capture")
        snapshot = fetch_snapshot(previous)
    elif previous:
        snapshot = previous
    else:
        parser.error("No snapshot; use --refresh for initial capture")
    corpus = build(snapshot)  # Validate everything before replacing either output.
    DATA.mkdir(parents=True, exist_ok=True)
    for path, content in ((SNAPSHOT, snapshot), (OUTPUT, corpus)):
        path.write_text(json.dumps(content, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Validated {len(corpus['hexagrams'])} hexagrams / 384 lines / 2 special passages; {corpus['sourceVersion']}")


if __name__ == "__main__":
    main()
