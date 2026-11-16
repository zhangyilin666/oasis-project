"""Explicit, one-call acceptance check using a public synthetic question.

Run from python_backend with --live. This does not create or change a user,
database row, or report. Credentials are read from the existing configuration.
"""
import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--live", action="store_true", help="Make exactly one real provider call")
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    if not args.live:
        parser.error("This check requires explicit --live; no provider call was made")

    from app.services.divination_facts import build_divination_facts
    from app.services.divination_service import _run_interpretation, validate_analysis

    input_data = {
        "question": "这是公开验收用的虚构问题：我怎样安排下一周的阅读和复盘？",
        "date": "2026-10-03", "time": "12:30", "utcOffset": 8,
        "method": "liuyao-coins", "lines": [9, 7, 9, 6, 7, 6],
        "coins": [[3, 3, 3], [3, 2, 2], [3, 3, 3], [2, 2, 2], [3, 2, 2], [2, 2, 2]],
    }
    facts = build_divination_facts(input_data, "liuyao-coins-v1")
    result = _run_interpretation(input_data, facts)
    if result.status != "success" or not isinstance(result.output, dict) or result.output.get("mock"):
        raise RuntimeError("Live interpretation did not complete; no acceptance artifact written")
    analysis = validate_analysis(result.output.get("analysis"), facts)
    report = {
        "verifiedAt": datetime.now(timezone.utc).isoformat(),
        "scope": "One real provider call with a synthetic question; no database writes",
        "status": "passed", "model": result.output.get("model"),
        "durationMs": round(result.duration_ms), "usage": result.output.get("usage"),
        "input": input_data, "ruleVersion": "liuyao-coins-v1", "facts": facts, "analysis": analysis,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({key: report[key] for key in ("status", "model", "durationMs", "usage")}, ensure_ascii=False))


if __name__ == "__main__":
    main()
