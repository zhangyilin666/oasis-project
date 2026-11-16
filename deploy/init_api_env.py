"""Create a private API environment file with independent random secrets."""

import os
from pathlib import Path
import secrets


ROOT = Path(__file__).resolve().parents[1]
TEMPLATE = ROOT / "deploy" / ".env.api.example"
TARGET = ROOT / ".env.api"
SECRET_NAMES = ("MYSQL_ROOT_PASSWORD", "MYSQL_PASSWORD", "JWT_SECRET_KEY")


def main() -> None:
    if TARGET.exists():
        raise SystemExit(f"{TARGET} already exists; it was not changed")
    content = TEMPLATE.read_text(encoding="utf-8")
    for name in SECRET_NAMES:
        marker = f"{name}=\n"
        if content.count(marker) != 1:
            raise SystemExit(f"Expected one empty {name} entry in template")
        content = content.replace(marker, f"{name}={secrets.token_hex(32)}\n", 1)
    descriptor = os.open(TARGET, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(descriptor, "w", encoding="utf-8", newline="\n") as output:
        output.write(content)
    print(f"Created {TARGET}; secrets were not printed")


if __name__ == "__main__":
    main()
