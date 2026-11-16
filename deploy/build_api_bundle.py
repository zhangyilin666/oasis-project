"""Build a credential-free archive for deploying the Android App API."""

from pathlib import Path
import tarfile


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "deploy" / "out" / "oasis-api.tar.gz"
FILES = (
    "docker-compose.api.yml",
    "docker-compose.api-ip.yml",
    "deploy/Caddyfile.api",
    "deploy/Caddyfile.api-ip",
    "deploy/oasis-api-cert-renew-hook.sh",
    "deploy/.env.api.example",
    "deploy/init_api_env.py",
    "python_backend/Dockerfile",
    "python_backend/.dockerignore",
    "python_backend/requirements.txt",
    "python_backend/alembic.ini",
)
DIRECTORIES = (
    "python_backend/app",
    "python_backend/alembic",
    "data_center/knowledge",
)
SKIP_PARTS = {"__pycache__", ".pytest_cache", ".venv", "node_modules"}
SKIP_SUFFIXES = {".pyc", ".pyo", ".log"}


def is_safe(path: Path) -> bool:
    relative = path.relative_to(ROOT)
    return (
        path.is_file()
        and not path.is_symlink()
        and not any(part in SKIP_PARTS or part.startswith(".env") for part in relative.parts)
        and path.suffix not in SKIP_SUFFIXES
    )


def main() -> None:
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    members = [ROOT / name for name in FILES]
    for directory in DIRECTORIES:
        members.extend(path for path in (ROOT / directory).rglob("*") if is_safe(path))
    members = sorted({path for path in members if path.is_file() and not path.is_symlink()})
    missing = [name for name in FILES if not (ROOT / name).is_file()]
    if missing:
        raise FileNotFoundError(f"Missing deployment files: {missing}")
    if not members:
        raise RuntimeError("No deployment files found")

    with tarfile.open(OUTPUT, "w:gz") as archive:
        for path in members:
            archive.add(path, arcname=path.relative_to(ROOT).as_posix(), recursive=False)
    print(f"Created {OUTPUT} with {len(members)} files")


if __name__ == "__main__":
    main()
