# -*- coding: utf-8 -*-
"""Build a deliberately bounded name-culture lookup from Unicode 17.0.0 data.

Only official data is downloaded. No executable third-party code is run.
Run with Python 3 and --archive PATH to reuse a previously downloaded zip.
"""
from __future__ import annotations

import argparse
import hashlib
import io
import json
from pathlib import Path
from urllib.request import urlopen
from zipfile import ZipFile

SOURCE = "https://www.unicode.org/Public/17.0.0/ucd/Unihan.zip"
SHA256 = "f7a48b2b545acfaa77b2d607ae28747404ce02baefee16396c5d2d7a8ef34b5e"
CHARACTERS = "张張王李陈陳林明安宁寧清乐樂行重𠮷赵趙钱錢孙孫周吴吳郑鄭冯馮朱许許何高刘劉黄黃欧歐阳陽司马馬云雲雨晴文心仁和思远遠泽澤然一若昕晨书書诗詩辰柏梓涵宇悦悅子萱芷沐青知予君竹山水修齐齊家国國礼禮智信嘉言羽星月光海川逸雅音南北东西東西龙龍龘吉"
PROPERTIES = {"kDefinition", "kMandarin", "kTotalStrokes", "kSimplifiedVariant", "kTraditionalVariant"}
REFERENCE_CHARACTERS = set("明清乐樂张張宁寧行重𠮷龘")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--archive", type=Path)
    args = parser.parse_args()
    raw = args.archive.read_bytes() if args.archive else urlopen(SOURCE, timeout=45).read()
    if hashlib.sha256(raw).hexdigest() != SHA256:
        raise ValueError("The fixed Unicode 17.0.0 archive hash changed; review before rebuilding.")
    selected = set(CHARACTERS)
    entries: dict[str, dict[str, str]] = {}
    references: list[str] = []
    with ZipFile(io.BytesIO(raw)) as archive:
        for filename in sorted(archive.namelist()):
            if not filename.endswith(".txt"):
                continue
            for line in archive.read(filename).decode("utf-8").splitlines():
                if not line or line.startswith("#"):
                    continue
                codepoint, prop, value = line.split("\t", 2)
                char = chr(int(codepoint[2:], 16))
                if char in selected and prop in PROPERTIES:
                    entries.setdefault(char, {})[prop] = value
                    if char in REFERENCE_CHARACTERS:
                        references.append(line)
    if set(entries) != selected:
        raise ValueError("Selected characters were missing from the fixed data.")
    project = Path(__file__).resolve().parents[1]
    target = project / "src/domain/names/unihan-subset.json"
    target.parent.mkdir(parents=True, exist_ok=True)
    data = {
        "version": "17.0.0", "license": "Unicode-3.0", "sourceUrl": SOURCE,
        "sourceSha256": SHA256, "characterCount": len(entries),
        "properties": sorted(PROPERTIES),
        "entries": {char: entries[char] for char in sorted(entries)},
    }
    target.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    fixture = project / "tests/fixtures/unihan-17-reference.txt"
    fixture.write_text(
        "# Unicode 17.0.0 raw reference lines. Unicode-3.0 license.\n"
        f"# Source: {SOURCE}\n# Archive SHA-256: {SHA256}\n"
        "# Extracted directly from the official archive, not generated from the runtime JSON.\n"
        + "\n".join(sorted(references)) + "\n", encoding="utf-8",
    )
    print(f"Wrote {len(entries)} characters and {len(references)} independent raw reference lines.")


if __name__ == "__main__":
    main()
