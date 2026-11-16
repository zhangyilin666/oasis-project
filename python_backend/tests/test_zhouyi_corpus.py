"""Offline checks for every source revision and all 450 classical passages."""
from copy import deepcopy
import hashlib
import importlib.util
import json
from pathlib import Path
import re
from urllib.parse import parse_qs, urlparse

import pytest

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "app" / "data"
SPEC = importlib.util.spec_from_file_location("zhouyi_builder", ROOT / "scripts" / "build_zhouyi_corpus.py")
builder = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(builder)
SNAPSHOT = json.loads((DATA / "zhouyi_wikisource_revisions.json").read_text(encoding="utf-8"))
CORPUS = json.loads((DATA / "zhouyi_corpus.json").read_text(encoding="utf-8"))


def test_offline_rebuild_exactly_matches_distributed_corpus():
    assert builder.build(SNAPSHOT) == CORPUS
    assert CORPUS["license"] == "CC-BY-SA-4.0"
    assert CORPUS["licenseUrl"] == "https://creativecommons.org/licenses/by-sa/4.0/"
    assert "维基文库贡献者" in CORPUS["attribution"]
    assert CORPUS["changes"] and CORPUS["extractorVersion"] and CORPUS["fetchedAt"]


def test_all_64_fixed_sources_have_verified_raw_hashes_and_unique_revision_urls():
    assert len(SNAPSHOT["pages"]) == 64
    assert len({page["title"] for page in SNAPSHOT["pages"]}) == 64
    for page, entry in zip(SNAPSHOT["pages"], CORPUS["hexagrams"]):
        expected = hashlib.sha256(page["wikitext"].encode("utf-8")).hexdigest()
        assert page["sha256"] == entry["source"]["rawSha256"] == expected
        parsed = urlparse(entry["source"]["url"])
        assert parsed.scheme == "https" and parsed.netloc == "zh.wikisource.org"
        assert parsed.path == "/w/index.php"
        query = parse_qs(parsed.query)
        assert query == {"title": [page["title"]], "oldid": [str(page["revisionId"])]}
        assert entry["source"]["revisionTimestamp"] == page["revisionTimestamp"]


def test_all_64_hexagrams_384_lines_and_two_specials_have_consistent_polarity():
    entries = CORPUS["hexagrams"]
    assert [e["number"] for e in entries] == list(range(1, 65))
    assert len({e["name"] for e in entries}) == 64
    assert len({tuple(e["lines"]) for e in entries}) == 64
    assert sum(len(e["lineTexts"]) for e in entries) == 384
    assert sum(len(e["specialTexts"]) for e in entries) == 2
    for entry in entries:
        assert entry["symbol"] == chr(0x4DC0 + entry["number"] - 1)
        assert entry["lines"] == entry["lower"]["lines"] + entry["upper"]["lines"]
        assert [line["position"] for line in entry["lineTexts"]] == [1, 2, 3, 4, 5, 6]
        for position, (line, polarity) in enumerate(zip(entry["lineTexts"], entry["lines"]), 1):
            digit = "九" if polarity else "六"
            assert line["title"] == ("初" + digit if position == 1 else "上" + digit if position == 6 else digit + "二三四五"[position-2])
        for passage in [entry["judgment"], *entry["lineTexts"], *entry["specialTexts"]]:
            assert passage["text"].strip()
            assert not re.search(r"[{}<>]|\[\[|\]\]|一作|彖曰|象曰|文言曰", passage["text"])
        assert [p["title"] for p in entry["specialTexts"]] == (["用九"] if entry["number"] == 1 else ["用六"] if entry["number"] == 2 else [])


def test_known_layout_and_variant_regressions_preserve_classical_text():
    entries = CORPUS["hexagrams"]
    assert entries[0]["judgment"]["text"] == "元亨。利貞。"
    assert entries[0]["lineTexts"][0]["text"] == "潛龍勿用。"
    assert entries[0]["specialTexts"][0]["text"] == "見羣龍无首，吉。"
    assert entries[1]["judgment"]["text"] == "元亨。利牝馬之貞。君子有攸往，先迷後得主。利西南得朋，東北喪朋。安貞，吉。"
    assert entries[1]["specialTexts"][0]["text"] == "利永貞。"
    # In these three judgments the name is part of the sentence, not a label.
    assert entries[9]["judgment"]["text"] == "履虎尾，不咥人，亨。"
    assert entries[11]["judgment"]["text"] == "否之匪人，不利君子貞，大往小來。"
    assert entries[12]["judgment"]["text"].startswith("同人于野，亨。")
    assert entries[11]["lineTexts"][0]["text"] == "拔茅茹以其彙，貞吉。亨。"
    passage = entries[63]["lineTexts"][3]
    assert passage["text"] == "貞吉，悔亡，震用伐鬼方，三年有賞于大國。"
    assert passage["variants"] == [{"primary": "國", "alternative": "邦"}]
    assert entries[28]["lineTexts"][3]["variants"][0]["alternative"] == "樽酒簋貳，用缶，納約自牖"


def test_builder_fails_closed_on_changed_source_or_unrecognized_markup():
    changed = deepcopy(SNAPSHOT)
    changed["pages"][0]["wikitext"] += "unaudited change"
    with pytest.raises(ValueError, match="hash mismatch"):
        builder.build(changed)
    with pytest.raises(ValueError, match="Unrecognized wikitext"):
        builder.clean_text("原文{{unknown|test}}")
    with pytest.raises(ValueError, match="64"):
        builder.build({**SNAPSHOT, "pages": SNAPSHOT["pages"][:-1]})
    changed = deepcopy(SNAPSHOT)
    changed["pages"][0]["wikitext"] = changed["pages"][0]["wikitext"].replace("初九：", "初六：", 1)
    changed["pages"][0]["sha256"] = builder.digest(changed["pages"][0]["wikitext"])
    with pytest.raises(ValueError, match="polarity mismatch"):
        builder.build(changed)
