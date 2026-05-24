#!/usr/bin/env python3
"""Prepare Lamp checkout for desktop launcher (submodule + Tortoise + preflight)."""

from __future__ import annotations

import os
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LAMP_DIR = ROOT / "lamp"
STAGE_STAMP = LAMP_DIR / ".desktop-stage-source"
TORTOISE_URL = "https://github.com/thebreadcat/tortoise.git"
LAMP_REPO = os.environ.get("LAMP_REPO", "https://github.com/thebreadcat/lamp.git")

IGNORE_NAMES = {
    ".git",
    "__pycache__",
    ".DS_Store",
    ".workshop",
    "node_modules",
    ".desktop-stage-source",
}


def run(cmd: list[str], *, cwd: Path | None = None, check: bool = True) -> subprocess.CompletedProcess:
    print("+", " ".join(cmd), flush=True)
    return subprocess.run(cmd, cwd=cwd or ROOT, check=check)


def load_dotenv() -> None:
    env_file = ROOT / ".env"
    if not env_file.is_file():
        return
    for line in env_file.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        value = value.strip().strip("'\"")
        os.environ.setdefault(key, value)


def git_available() -> bool:
    return shutil.which("git") is not None


def is_lamp_dir(path: Path) -> bool:
    return (path / "lamp.py").is_file()


def init_submodule() -> None:
    if not git_available() or not (ROOT / ".git").exists():
        return
    if is_lamp_dir(LAMP_DIR):
        return
    if not (ROOT / ".gitmodules").is_file():
        return
    run(["git", "submodule", "update", "--init", "--recursive"], check=False)


def clone_lamp_repo() -> Path | None:
    """CI / fresh clone — no submodule or sibling checkout."""
    if is_lamp_dir(LAMP_DIR):
        return LAMP_DIR.resolve()
    if not git_available():
        return None
    print(f"Cloning Lamp from {LAMP_REPO}", flush=True)
    if LAMP_DIR.exists():
        shutil.rmtree(LAMP_DIR)
    code, _ = run(["git", "clone", "--depth", "1", LAMP_REPO, str(LAMP_DIR)], check=False)
    if code != 0 or not is_lamp_dir(LAMP_DIR):
        return None
    return LAMP_DIR.resolve()


def discover_lamp_source() -> Path | None:
    env = os.environ.get("LAMP_PATH", "").strip()
    if env:
        p = Path(env).expanduser().resolve()
        return p if is_lamp_dir(p) else None

    if is_lamp_dir(LAMP_DIR):
        return LAMP_DIR.resolve()

    sibling = (ROOT.parent / "lamp").resolve()
    if is_lamp_dir(sibling):
        return sibling

    return None


def stage_lamp(src: Path) -> Path:
    """Copy Lamp into lamp/ so electron-builder can bundle it."""
    src = src.resolve()
    if src == LAMP_DIR.resolve() and is_lamp_dir(LAMP_DIR):
        return LAMP_DIR

    stamp = STAGE_STAMP.read_text().strip() if STAGE_STAMP.is_file() else ""
    if is_lamp_dir(LAMP_DIR) and stamp == str(src):
        print(f"ok: lamp already staged from {src}")
        return LAMP_DIR

    print(f"Staging Lamp into {LAMP_DIR} from {src}", flush=True)
    if LAMP_DIR.exists():
        shutil.rmtree(LAMP_DIR)
    LAMP_DIR.mkdir(parents=True)

    def ignore(dirpath: str, names: list[str]) -> set[str]:
        base = set(IGNORE_NAMES)
        return {n for n in names if n in base}

    shutil.copytree(src, LAMP_DIR, dirs_exist_ok=True, ignore=ignore)
    STAGE_STAMP.write_text(str(src))
    return LAMP_DIR


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


def ensure_build_icon(lamp_dir: Path) -> None:
    build = ROOT / "build"
    build.mkdir(exist_ok=True)
    png = build / "icon.png"
    if png.is_file():
        return
    for candidate in (
        lamp_dir / "assets" / "favicon.svg",
        lamp_dir / "assets" / "lamp-logo.svg",
    ):
        if not candidate.is_file():
            continue
        for cmd in (
            ["magick", "-background", "none", "-density", "512", str(candidate), "-resize", "512x512", str(png)],
            ["convert", "-background", "none", "-density", "512", str(candidate), "-resize", "512x512", str(png)],
            ["rsvg-convert", "-w", "512", "-h", "512", str(candidate), "-o", str(png)],
        ):
            if shutil.which(cmd[0]):
                run(cmd, check=False)
                if png.is_file():
                    print(f"ok: wrote {png}")
                    return
    print("warn: build/icon.png missing — mac build may fail without icons", file=sys.stderr)


def main() -> None:
    load_dotenv()
    init_submodule()
    src = discover_lamp_source() or clone_lamp_repo()
    if not src:
        sys.exit(
            "Lamp not found.\n"
            "  git submodule update --init --recursive\n"
            "  export LAMP_PATH=/path/to/lamp\n"
            "  or place lamp next to lamp-desktop (../lamp)"
        )
    lamp_dir = stage_lamp(src)
    ensure_tortoise(lamp_dir)
    tortoise = lamp_dir / "vendor" / "workshop" / "vendor" / "tortoise" / "tortoise.py"
    if not tortoise.is_file():
        sys.exit(
            "Tortoise is required in the Lamp bundle for end-user installs.\n"
            "  python3 scripts/ensure-lamp.py  (with network/git)\n"
            "Release builds must include Tortoise before packaging."
        )
    run_preflight(lamp_dir)
    ensure_build_icon(lamp_dir)
    print(f"ok: lamp ready at {lamp_dir}")


if __name__ == "__main__":
    main()
