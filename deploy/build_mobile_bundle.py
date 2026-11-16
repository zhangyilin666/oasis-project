"""Build production H5 and package it with API sources, without local secrets."""

import hashlib
import os
from pathlib import Path
import subprocess
import tarfile

from build_api_bundle import DIRECTORIES, FILES, ROOT, is_safe


OUTPUT = ROOT / "deploy" / "out" / "oasis-mobile.tar.gz"
WEB = ROOT / "oasis-uniapp"
EXTRA_FILES = (
    "docker-compose.api-mobile.yml",
    "deploy/Caddyfile.api-mobile",
    "deploy/MOBILE_IP_GUIDE.md",
)
PRIVATE_SUFFIXES = {".pem", ".key", ".keystore", ".p12", ".pfx"}


def main() -> None:
    environment = dict(os.environ, VITE_DEMO_MODE="false", VITE_API_BASE_URL="")
    npm = "npm.cmd" if os.name == "nt" else "npm"
    subprocess.run([npm, "run", "build:h5"], cwd=WEB, env=environment, check=True)
    if not (WEB / "dist/build/h5/index.html").is_file():
        raise RuntimeError("H5 build did not produce index.html")

    members = [ROOT / name for name in (*FILES, *EXTRA_FILES)]
    for directory in (*DIRECTORIES, "oasis-uniapp/dist/build/h5"):
        members.extend(
            path for path in (ROOT / directory).rglob("*")
            if is_safe(path) and path.suffix.lower() not in PRIVATE_SUFFIXES
        )
    missing = [str(path.relative_to(ROOT)) for path in members if not path.is_file()]
    if missing:
        raise FileNotFoundError(f"Missing deployment files: {missing}")
    members = sorted(set(members))
    if any(path.is_symlink() for path in members):
        raise RuntimeError("Deployment files must not be symbolic links")

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    temporary = OUTPUT.with_suffix(".tmp")
    with tarfile.open(temporary, "w:gz") as archive:
        for path in members:
            archive.add(path, arcname=path.relative_to(ROOT).as_posix(), recursive=False)
    temporary.replace(OUTPUT)
    digest = hashlib.sha256(OUTPUT.read_bytes()).hexdigest()
    OUTPUT.with_name(OUTPUT.name + ".sha256").write_text(
        f"{digest}  {OUTPUT.name}\n", encoding="utf-8"
    )
    print(f"Created {OUTPUT} with {len(members)} files; SHA256 {digest}")


if __name__ == "__main__":
    main()
