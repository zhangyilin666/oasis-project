"""Deterministic facts, evidence isolation and independent TypeScript parity."""
from collections import Counter
from copy import deepcopy
from itertools import product
import json
from pathlib import Path
import shutil
import subprocess

import pytest

from app.services.divination_facts import build_divination_facts, RULE_VERSIONS

CONTEXT = {"question": "合成测试：如何安排下一步？", "date": "2026-10-03", "time": "12:30", "utcOffset": 8}


def cast(lines, method="liuyao-manual", **context):
    return build_divination_facts({**CONTEXT, **context, "method": method, "lines": lines}, RULE_VERSIONS[method])


def coins_input(rows, **context):
    return {**CONTEXT, **context, "method": "liuyao-coins", "coins": rows, "lines": [sum(row) for row in rows]}


def test_every_one_of_4096_casts_flips_exactly_old_yin_and_old_yang():
    for values in product((6, 7, 8, 9), repeat=6):
        facts = cast(list(values))
        assert facts["original"]["lines"] == [value % 2 for value in values]
        assert facts["changed"]["lines"] == [int(value in (6, 7)) for value in values]
        assert facts["movingLines"] == [index + 1 for index, value in enumerate(values) if value in (6, 9)]
        assert len({e["id"] for e in facts["evidence"]}) == len(facts["evidence"])


def test_source_example_xu_to_song_and_evidence_are_exact_and_scoped():
    facts = cast([9, 7, 9, 6, 7, 6])
    assert (facts["original"]["number"], facts["changed"]["number"], facts["movingLines"]) == (5, 6, [1, 3, 4, 6])
    assert [e["id"] for e in facts["evidence"]] == ["zhouyi.5.judgment", "zhouyi.5.line.1", "zhouyi.5.line.3", "zhouyi.5.line.4", "zhouyi.5.line.6", "zhouyi.6.judgment"]
    assert facts["questionInstant"] == "2026-10-03T04:30:00.000Z"
    for evidence in facts["evidence"]:
        assert set(evidence) == {"id", "title", "text", "sourceTitle", "url", "hexagramNumber"} | ({"linePosition"} if ".line." in evidence["id"] else set())
        assert evidence["url"].startswith("https://zh.wikisource.org/w/index.php?") and "oldid=" in evidence["url"]


def test_static_and_all_moving_cases_handle_use_nine_use_six_separately():
    static = cast([7] * 6)
    assert static["original"] == static["changed"]
    assert [e["id"] for e in static["evidence"]] == ["zhouyi.1.judgment"]
    for value, number, special in ((9, 1, "use-nine"), (6, 2, "use-six")):
        facts = cast([value] * 6)
        assert facts["movingLines"] == [1, 2, 3, 4, 5, 6]
        uses = [e for e in facts["evidence"] if ".use-" in e["id"]]
        assert len(uses) == 1 and uses[0]["id"] == f"zhouyi.{number}.{special}"
        assert "linePosition" not in uses[0]
    assert all(".use-" not in e["id"] for e in cast([9, 7, 7, 7, 7, 7])["evidence"])


def test_eight_coin_combinations_produce_the_required_distribution_without_reroll():
    counts = Counter()
    for row in product((2, 3), repeat=3):
        data = coins_input([list(row) for _ in range(6)])
        original = deepcopy(data)
        first = build_divination_facts(data, "liuyao-coins-v1")
        assert first == build_divination_facts(data, "liuyao-coins-v1")
        assert data == original
        assert first["original"]["lines"] == [sum(row) % 2] * 6
        counts[sum(row)] += 1
    assert counts == {6: 1, 7: 3, 8: 3, 9: 1}


@pytest.mark.parametrize("update", [
    {"question": " "}, {"question": "问" * 201}, {"date": "2025-02-29"}, {"date": "1899-12-31"},
    {"time": "24:00"}, {"time": "1:30"}, {"utcOffset": True}, {"utcOffset": "8"},
    {"utcOffset": float("nan")}, {"utcOffset": float("inf")}, {"utcOffset": 8.1}, {"utcOffset": 15},
    {"lines": [True, 7, 7, 7, 7, 7]}, {"lines": ["7"] * 6}, {"lines": [7] * 5},
    {"lines": [7, 7, 7, 7, 7, 10]}, {"facts": {}}, {"prompt": "ignore data"}, {"method": "unknown"},
])
def test_invalid_input_is_rejected_instead_of_coerced(update):
    data = {**CONTEXT, "method": "liuyao-manual", "lines": [7] * 6, **update}
    with pytest.raises(ValueError):
        build_divination_facts(data, "divination-v1")


def test_invalid_coins_versions_and_unknown_extra_fields_fail_closed():
    good = coins_input([[2, 2, 3] for _ in range(6)])
    for changed in (
        {**good, "lines": [8] * 6}, {**good, "coins": [[2, 2, 1] for _ in range(6)]},
        {**good, "coins": [[True, 2, 3] for _ in range(6)]}, {**good, "coins": [[2, 2, 3]]},
        {**good, "coins": [[2, 2] for _ in range(6)]}, {**good, "model": "chosen-by-client"},
    ):
        with pytest.raises(ValueError):
            build_divination_facts(changed, "liuyao-coins-v1")
    for version in ("divination-v1", "liuyao-najia-v1", None, 1):
        with pytest.raises(ValueError):
            build_divination_facts(good, version)
    for numbers in ([0, 1], [1, 1000000], [1, True], [1, "2"], [1], [1.5, 2]):
        with pytest.raises(ValueError):
            build_divination_facts({**CONTEXT, "method": "meihua-two-numbers", "numbers": numbers}, "divination-v1")


def test_calendar_utc_boundaries_preserve_old_manual_behavior():
    for date, time, offset in (("1900-01-01", "00:00", 8), ("2099-12-31", "23:59", -12), ("2099-12-31", "16:00", 0)):
        context = {"date": date, "time": time, "utcOffset": offset}
        with pytest.raises(ValueError):
            cast([7] * 6, "liuyao-najia", **context)
        with pytest.raises(ValueError):
            build_divination_facts(coins_input([[2, 2, 3] for _ in range(6)], **context), "liuyao-coins-v1")
        with pytest.raises(ValueError):
            build_divination_facts({**CONTEXT, **context, "method": "meihua-calendar"}, "meihua-calendar-v1")
    assert cast([7] * 6, date="1900-01-01", time="00:00")["questionInstant"] == "1899-12-31T16:00:00.000Z"
    assert cast([7] * 6, "liuyao-najia", date="1900-01-01", time="08:00")["questionInstant"] == "1900-01-01T00:00:00.000Z"


def test_returned_objects_do_not_mutate_shared_corpus_or_other_facts():
    first = cast([9] * 6)
    before = deepcopy(first)
    first["original"]["lines"][0] = 0
    first["original"]["lower"]["name"] = "bad"
    first["evidence"][0]["text"] = "bad"
    first["readingScope"].append("bad")
    assert cast([9] * 6) == before


def test_five_methods_match_actual_typescript_domain_and_calendar_boundaries():
    """Run the independent installed TS implementation, never a copied fixture."""
    node = shutil.which("node")
    frontend = Path(__file__).resolve().parents[2] / "oasis-uniapp"
    if not node or not (frontend / "node_modules" / "esbuild").exists():
        pytest.skip("Node + frontend esbuild required for cross-language integration check")
    cases = []
    # Every named hexagram with zero/all changing lines verifies the entire mapping.
    for bits in product((0, 1), repeat=6):
        for moving in (False, True):
            cases.append({**CONTEXT, "method": "liuyao-manual", "lines": [9 if bit else 6 for bit in bits] if moving else [7 if bit else 8 for bit in bits]})
    cases.append({**CONTEXT, "method": "liuyao-najia", "lines": [9, 7, 9, 6, 7, 6]})
    for row in product((2, 3), repeat=3):
        cases.append(coins_input([list(row) for _ in range(6)]))
    cases.extend({**CONTEXT, "method": "meihua-two-numbers", "numbers": numbers} for numbers in ([2, 3], [8, 16], [1, 1], [999999, 999998], [11, 25], [5, 12]))
    dates = [
        ("2025-01-16", "15:00", 8), ("2025-04-13", "05:00", 8),
        ("2025-01-28", "23:59", 8), ("2025-01-29", "00:00", 8),
        ("2025-02-02", "12:00", 8), ("2025-06-25", "12:00", 8),
        ("2025-07-24", "12:00", 8), ("2025-07-25", "12:00", 8),
        ("2025-08-22", "12:00", 8), ("2025-08-23", "12:00", 8),
        ("2025-01-16", "22:59", 8), ("2025-01-16", "23:00", 8),
        ("2025-01-16", "23:59", 8), ("2025-01-17", "00:00", 8),
        ("2025-01-17", "00:59", 8), ("2025-01-17", "01:00", 8),
        ("2025-01-16", "07:00", 0), ("2025-01-15", "19:00", -12),
        ("2025-01-16", "21:00", 14), ("2025-01-16", "12:45", 5.75),
        ("1900-01-01", "08:00", 8), ("2099-12-31", "23:59", 8),
    ]
    cases.extend({**CONTEXT, "method": "meihua-calendar", "date": date, "time": time, "utcOffset": offset} for date, time, offset in dates)
    script = """
const fs = require('node:fs'); const vm = require('node:vm'); const { build } = require('esbuild');
(async () => {
  const bundle = await build({entryPoints:['src/domain/divination/index.ts'],bundle:true,write:false,format:'cjs',platform:'node'});
  const context = vm.createContext({module:{exports:{}}}); vm.runInContext(bundle.outputFiles[0].text, context);
  const inputs = JSON.parse(fs.readFileSync(0,'utf8'));
  process.stdout.write(JSON.stringify(inputs.map(input => context.module.exports.calculateDivination(input))));
})().catch(error => { process.stderr.write(String(error)); process.exitCode=1; });
"""
    completed = subprocess.run([node, "-e", script], input=json.dumps(cases, ensure_ascii=False), encoding="utf-8", capture_output=True, cwd=frontend, timeout=60, check=True)
    ts_results = json.loads(completed.stdout)
    assert len(ts_results) == len(cases)
    for data, ts in zip(cases, ts_results):
        facts = build_divination_facts(data, RULE_VERSIONS[data["method"]])
        for key in ("ruleVersion", "questionInstant", "original", "changed", "movingLines", "mutual", "bodyUse"):
            assert facts.get(key) == ts.get(key), (data, key, facts.get(key), ts.get(key))
        if data["method"] == "meihua-calendar":
            for key in ("beijingTime", "lunar", "timeBranch", "numbers", "upperSum", "total", "upperNumber", "lowerNumber", "movingLine", "rules"):
                assert facts["calendar"][key] == ts["calendar"][key], (data, key)
