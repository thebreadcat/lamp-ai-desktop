#!/usr/bin/env python3
"""Prepare Lamp checkout for desktop launcher (submodule + Tortoise + preflight)."""

from __future__ import annotations

import os
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LAMP_SUBMODULE = ROOT / "lamp"
TORTOISE_URL = "https://github.com/thebreadcat/tortoise.git"
TORTOISE_DIR = LAMP_SUBMODULE / "vendor" / "workshop" / "vendor" / "tortoise"


def run(cmd: list[str], *, cwd: Path | None = None, check: bool = True) -> subprocess.CompletedProcess:
    print("+", " ".join(cmd), flush=True)
    return subprocess.run(cmd, cwd=cwd or ROOT, check=check)


def resolve_lamp_dir() -> Path:
    env = os.environ.get("LAMP_PATH", "").strip()
    if env:
        p = Path(env).expanduser().resolve()
        if not (p / "lamp.py").is_file():
            sys.exit(f"LAMP_PATH does not contain lamp.py: {p}")
        return p
    return LAMP_SUBMODULE.resolve()


def git_available() -> bool:
    return shutil.which("git") is not None


def init_submodule() -> None:
    if not git_available():
        print("warn: git not found; skip submodule init", file=sys.stderr)
        return
    if not (ROOT / ".git").exists():
        return
    if (LAMP_SUBMODULE / "lamp.py").is_file():
        return
    run(["git", "submodule", "update", "--init", "--recursive"])


def ensure_tortoise(lamp_dir: Path) -> None:
    tortoise = lamp_dir / "vendor" / "workshop" / "vendor" / "tortoise"
    if (tortoise / ".git").exists() or (tortoise / "tortoise.py").is_file():
        return
    if not git_available():
        sys.exit(
            "Tortoise is missing and git is not available.\n"
            f"Clone manually:\n  git clone {TORTOISE_URL} {tortoise}"
        )
    tortoise.parent.mkdir(parents=True, exist_ok=True)
    run(["git", "clone", "--depth", "1", TORTOISE_URL, str(tortoise)])


def run_preflight(lamp_dir: Path) -> None:
    preflight = lamp_dir / "setup" / "preflight.sh"
    if preflight.is_file() and os.access(preflight, os.X_OK):
        run(["bash", str(preflight)], cwd=lamp_dir, check=False)


def main() -> None:
    init_submodule()
    lamp_dir = resolve_lamp_dir()
    if not (lamp_dir / "lamp.py").is_file():
        sys.exit(
            "Lamp not found.\n"
            "  git submodule update --init --recursive\n"
            "  or set LAMP_PATH=/path/to/lamp"
        )
    ensure_tortoise(lamp_dir)
    run_preflight(lamp_dir)
    print(f"ok: lamp ready at {lamp_dir}")


if __name__ == "__main__":
    main()
