#!/usr/bin/env python3
"""First-run setup API for Lamp Desktop — checks and installs dependencies."""

from __future__ import annotations

import argparse
import json
import os
import platform
import shutil
import subprocess
import sys
import time
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

SETUP_VERSION = 2
DEFAULT_PORT = 7701
OLLAMA_ENDPOINT = "http://127.0.0.1:11434/v1"
TORTOISE_URL = "https://github.com/thebreadcat/tortoise.git"
STATE_DIR = Path.home() / ".lamp-desktop"
COMPLETE_FILE = STATE_DIR / "setup-complete.json"

ROOT = Path(__file__).resolve().parents[1]
SETUP_UI = ROOT / "setup"


def log(msg: str) -> None:
    print(f"[setup] {msg}", flush=True)


def run_cmd(cmd: list[str], *, cwd: Path | None = None, timeout: int | None = None) -> tuple[int, str]:
    try:
        p = subprocess.run(
            cmd,
            cwd=cwd,
            capture_output=True,
            text=True,
            timeout=timeout,
        )
        out = (p.stdout or "") + (p.stderr or "")
        return p.returncode, out.strip()
    except subprocess.TimeoutExpired:
        return -1, "timed out"
    except FileNotFoundError:
        return -1, f"command not found: {cmd[0]}"


def ram_gb() -> float:
    system = platform.system()
    try:
        if system == "Darwin":
            code, out = run_cmd(["sysctl", "-n", "hw.memsize"])
            if code == 0:
                return int(out) / (1024**3)
        if system == "Linux" and Path("/proc/meminfo").exists():
            for line in Path("/proc/meminfo").read_text().splitlines():
                if line.startswith("MemTotal:"):
                    kb = int(line.split()[1])
                    return kb / (1024**2)
        if system == "Windows":
            code, out = run_cmd(
                ["powershell", "-NoProfile", "-Command",
                 "(Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory"]
            )
            if code == 0 and out.isdigit():
                return int(out) / (1024**3)
    except (ValueError, OSError):
        pass
    return 8.0


def pick_model() -> str:
    gb = ram_gb()
    if gb >= 14:
        return "qwen2.5:7b"
    if gb >= 6:
        return "qwen2.5:3b"
    return "qwen2.5:1.5b"


def model_label(name: str) -> str:
    labels = {
        "qwen2.5:7b": "Best quality (needs ~8 GB+ RAM)",
        "qwen2.5:3b": "Balanced (good for most Macs and PCs)",
        "qwen2.5:1.5b": "Lightweight (older or 4 GB RAM machines)",
    }
    return labels.get(name, name)


def python_info() -> dict:
    v = sys.version_info
    ok = (v.major, v.minor) >= (3, 10)
    bundled = os.environ.get("LAMP_BUNDLED_PYTHON", "").lower() in ("1", "true", "yes")
    return {
        "ok": ok,
        "version": f"{v.major}.{v.minor}.{v.micro}",
        "bundled": bundled,
        "hint": None if ok else "Install Python 3.10 or newer from https://www.python.org/downloads/",
    }


def lamp_root() -> Path:
    env = os.environ.get("LAMP_ROOT", "").strip()
    if env:
        p = Path(env).resolve()
        if (p / "lamp.py").is_file():
            return p
    for candidate in (ROOT / "lamp",):
        if (candidate / "lamp.py").is_file():
            return candidate.resolve()
    bundled = os.environ.get("LAMP_BUNDLED", "").strip()
    if bundled:
        p = Path(bundled).resolve()
        if (p / "lamp.py").is_file():
            return p
    return ROOT / "lamp"


def lamp_info() -> dict:
    root = lamp_root()
    ok = (root / "lamp.py").is_file()
    workshop = (root / "vendor" / "workshop" / "workshop.py").is_file()
    return {
        "ok": ok and workshop,
        "path": str(root) if ok else None,
        "workshop": workshop,
        "hint": None if ok and workshop else "Lamp files are missing from this install.",
    }


def tortoise_info() -> dict:
    root = lamp_root()
    t = root / "vendor" / "workshop" / "vendor" / "tortoise" / "tortoise.py"
    ok = t.is_file()
    return {
        "ok": ok,
        "hint": None if ok else "Tortoise (app engine) will be downloaded automatically.",
    }


def ensure_tortoise() -> dict:
    root = lamp_root()
    tortoise = root / "vendor" / "workshop" / "vendor" / "tortoise"
    if (tortoise / "tortoise.py").is_file():
        return {"ok": True, "message": "Tortoise already installed"}
    if not shutil.which("git"):
        return {"ok": False, "message": "Git is required to download Tortoise. Install from https://git-scm.com/"}
    tortoise.parent.mkdir(parents=True, exist_ok=True)
    code, out = run_cmd(["git", "clone", "--depth", "1", TORTOISE_URL, str(tortoise)], timeout=300)
    return {"ok": code == 0, "message": out or ("Tortoise installed" if code == 0 else "Clone failed")}


def ollama_bin() -> str | None:
    found = shutil.which("ollama")
    if found:
        return found
    extra = [
        "/usr/local/bin/ollama",
        "/opt/homebrew/bin/ollama",
        str(Path.home() / ".local" / "bin" / "ollama"),
    ]
    if platform.system() == "Windows":
        local = os.environ.get("LOCALAPPDATA", "")
        extra = [
            str(Path(local) / "Programs" / "Ollama" / "ollama.exe"),
            r"C:\Program Files\Ollama\ollama.exe",
        ] + extra
    for p in extra:
        if Path(p).is_file():
            return p
    return None


def ollama_installed() -> dict:
    ok = ollama_bin() is not None
    return {
        "ok": ok,
        "hint": None if ok else "Ollama runs the AI on your computer. We'll help you install it.",
    }


def ollama_running() -> dict:
    try:
        req = urllib.request.Request("http://127.0.0.1:11434/api/tags")
        with urllib.request.urlopen(req, timeout=3) as r:
            json.loads(r.read())
        return {"ok": True, "hint": None}
    except Exception:
        return {
            "ok": False,
            "hint": "Ollama isn't running yet. Open the Ollama app from your Applications folder, or we'll start it for you.",
        }


def list_ollama_models() -> list[str]:
    try:
        req = urllib.request.Request("http://127.0.0.1:11434/api/tags")
        with urllib.request.urlopen(req, timeout=5) as r:
            data = json.loads(r.read())
        return [m.get("name", "") for m in data.get("models", []) if m.get("name")]
    except Exception:
        return []


def model_has(name: str, installed: list[str]) -> bool:
    want = name.split(":")[0].lower()
    for m in installed:
        if m == name or m.split(":")[0].lower() == want:
            return True
    return False


def config_info() -> dict:
    cfg_path = Path.home() / ".workshop" / "config.json"
    if not cfg_path.is_file():
        return {"ok": False, "path": str(cfg_path), "hint": "We'll create your Lamp settings automatically."}
    try:
        cfg = json.loads(cfg_path.read_text())
    except json.JSONDecodeError:
        return {"ok": False, "hint": "Config file is invalid — we'll fix it."}
    ok = bool(cfg.get("endpoint")) and bool(cfg.get("model"))
    return {
        "ok": ok,
        "endpoint": cfg.get("endpoint"),
        "model": cfg.get("model"),
        "hint": None if ok else "Connecting Lamp to Ollama.",
    }


def voice_info() -> dict:
    ff = shutil.which("ffmpeg") is not None
    whisper = False
    try:
        import whisper  # noqa: F401
        whisper = True
    except ImportError:
        pass
    ok = ff and whisper
    return {
        "ok": ok,
        "optional": True,
        "ffmpeg": ff,
        "whisper": whisper,
        "hint": None if ok else "Optional: better voice dictation in chat (you can skip and use the browser mic).",
    }


def write_config(model: str) -> dict:
    cfg_dir = Path.home() / ".workshop"
    apps_dir = Path.home() / "workshop-apps"
    cfg_dir.mkdir(parents=True, exist_ok=True)
    apps_dir.mkdir(parents=True, exist_ok=True)
    cfg_path = cfg_dir / "config.json"
    existing = {}
    if cfg_path.is_file():
        try:
            existing = json.loads(cfg_path.read_text())
        except json.JSONDecodeError:
            pass
    cfg = {
        "endpoint": OLLAMA_ENDPOINT,
        "model": model,
        "api_key": None,
        "apps_dir": str(apps_dir),
        "users": existing.get("users") or [],
        "whisper_model": existing.get("whisper_model") or "tiny",
    }
    cfg_path.write_text(json.dumps(cfg, indent=2))
    return {"ok": True, "path": str(cfg_path), "model": model}


def install_ollama() -> dict:
    if ollama_bin():
        return {"ok": True, "message": "Ollama is already installed"}
    system = platform.system()
    if system in ("Darwin", "Linux"):
        code, out = run_cmd(
            ["bash", "-c", "curl -fsSL https://ollama.com/install.sh | sh"],
            timeout=900,
        )
        if code == 0 or ollama_bin():
            return {"ok": True, "message": out or "Ollama installed"}
        return {"ok": False, "message": out or "Install failed — try opening ollama.com/download"}
    if system == "Windows":
        if shutil.which("winget"):
            code, out = run_cmd(
                [
                    "winget", "install", "-e", "--id", "Ollama.Ollama",
                    "--accept-package-agreements", "--accept-source-agreements",
                ],
                timeout=900,
            )
            if code == 0 or ollama_bin():
                return {"ok": True, "message": "Ollama installed"}
        return {
            "ok": False,
            "message": "Could not install Ollama automatically.",
            "open_url": "https://ollama.com/download",
        }
    return {"ok": False, "message": f"Unsupported OS: {system}"}


def install_ollama_retries(retries: int = 3) -> dict:
    last = {"ok": False, "message": "unknown"}
    for i in range(retries):
        last = install_ollama()
        if last.get("ok"):
            return last
        time.sleep(2)
    return last


def start_ollama() -> dict:
    if not ollama_bin():
        return {"ok": False, "message": "Ollama not installed"}
    if ollama_running()["ok"]:
        return {"ok": True, "message": "Ollama is already running"}
    system = platform.system()
    try:
        if system == "Darwin":
            subprocess.Popen(
                ["open", "-a", "Ollama"],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
        elif system == "Windows":
            paths = [
                Path(os.environ.get("LOCALAPPDATA", "")) / "Programs" / "Ollama" / "ollama app.exe",
                Path("C:/Program Files/Ollama/ollama app.exe"),
            ]
            for p in paths:
                if p.is_file():
                    subprocess.Popen([str(p)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                    break
            else:
                subprocess.Popen(["ollama", "serve"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        else:
            subprocess.Popen(
                ["ollama", "serve"],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
        for _ in range(90):
            time.sleep(1)
            if ollama_running()["ok"]:
                return {"ok": True, "message": "Ollama is running"}
        return {"ok": False, "message": "Ollama didn't start in time — open the Ollama app once, then restart Lamp."}
    except Exception as e:
        return {"ok": False, "message": str(e)}


def pull_model_stream(model: str):
    if not ollama_bin():
        yield {"t": "error", "msg": "Ollama not installed"}
        return
    yield {"t": "log", "text": f"Downloading {model} — this can take several minutes…"}
    try:
        proc = subprocess.Popen(
            ["ollama", "pull", model],
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
        )
        for line in proc.stdout or []:
            yield {"t": "log", "text": line.rstrip()}
        proc.wait()
        yield {"t": "done", "ok": proc.returncode == 0}
    except Exception as e:
        yield {"t": "error", "msg": str(e)}


def install_voice() -> dict:
    root = lamp_root()
    req = root / "requirements-voice.txt"
    if not req.is_file():
        return {"ok": False, "message": "requirements-voice.txt not found"}
    pip = [sys.executable, "-m", "pip", "install", "-q", "-r", str(req)]
    code, out = run_cmd(pip, timeout=900)
    if code != 0:
        return {"ok": False, "message": out or "pip install failed"}
    system = platform.system()
    if not shutil.which("ffmpeg"):
        if system == "Darwin" and shutil.which("brew"):
            run_cmd(["brew", "install", "ffmpeg"], timeout=600)
        elif system == "Linux" and shutil.which("apt-get"):
            run_cmd(["sudo", "apt-get", "install", "-y", "ffmpeg"], timeout=300)
        elif system == "Windows" and shutil.which("winget"):
            run_cmd(["winget", "install", "-e", "--id", "Gyan.FFmpeg", "--accept-package-agreements"], timeout=600)
    return {"ok": voice_info()["ok"], "message": "Voice add-ons installed" if voice_info()["ok"] else "Whisper installed; install ffmpeg for full voice support (brew install ffmpeg)."}


def load_complete() -> dict | None:
    if not COMPLETE_FILE.is_file():
        return None
    try:
        return json.loads(COMPLETE_FILE.read_text())
    except json.JSONDecodeError:
        return None


def mark_complete(skipped_voice: bool = False) -> None:
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    COMPLETE_FILE.write_text(
        json.dumps(
            {
                "version": SETUP_VERSION,
                "completed_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                "skipped_voice": skipped_voice,
            },
            indent=2,
        )
    )


def clear_complete() -> None:
    if COMPLETE_FILE.is_file():
        COMPLETE_FILE.unlink()


def resolve_model() -> str:
    recommended = pick_model()
    installed = list_ollama_models() if ollama_running()["ok"] else []
    if model_has(recommended, installed):
        return recommended
    if installed:
        return installed[0]
    return recommended


def retry_step(name: str, fn, retries: int = 3):
    last = {"ok": False, "message": "failed"}
    for attempt in range(1, retries + 1):
        last = fn()
        if last.get("ok"):
            return last
        time.sleep(min(attempt * 2, 6))
    return last


def bootstrap_stream():
    """One-shot automatic setup — no user clicks required."""
    yield {"t": "step", "id": "welcome", "state": "done", "text": "Setting up Lamp on your computer…"}

    def st():
        return full_status()

    if not st()["steps"]["lamp"]["ok"]:
        yield {"t": "error", "msg": "Lamp files are missing from this install."}
        return

    if not st()["steps"]["tortoise"]["ok"]:
        yield {"t": "step", "id": "tortoise", "state": "start", "text": "Downloading app engine…"}
        r = retry_step("tortoise", ensure_tortoise)
        if not r.get("ok"):
            yield {"t": "step", "id": "tortoise", "state": "fail", "text": r.get("message", "Tortoise failed")}
            yield {"t": "error", "msg": r.get("message", "Could not install Tortoise")}
            return
        yield {"t": "step", "id": "tortoise", "state": "done", "text": "App engine ready"}

    if not st()["steps"]["ollama_installed"]["ok"]:
        yield {"t": "step", "id": "ollama", "state": "start", "text": "Installing Ollama (local AI)…"}
        yield {"t": "log", "text": "This may ask for your password once."}
        r = retry_step("ollama", install_ollama_retries)
        if not r.get("ok"):
            yield {"t": "step", "id": "ollama", "state": "fail", "text": r.get("message", "")}
            yield {"t": "error", "msg": r.get("message", "Ollama install failed"), "open_url": r.get("open_url")}
            return
        yield {"t": "step", "id": "ollama", "state": "done", "text": "Ollama installed"}

    if not ollama_running()["ok"]:
        yield {"t": "step", "id": "ollama_start", "state": "start", "text": "Starting Ollama…"}
        r = retry_step("start", start_ollama, retries=5)
        if not r.get("ok"):
            yield {"t": "error", "msg": r.get("message", "Could not start Ollama")}
            return
        yield {"t": "step", "id": "ollama_start", "state": "done", "text": "Ollama is running"}

    model = resolve_model()
    installed = list_ollama_models()
    if not model_has(model, installed) and not installed:
        yield {"t": "step", "id": "model", "state": "start", "text": f"Downloading AI model ({model})…"}
        yield {"t": "log", "text": "First time only — can take 5–15 minutes."}
        for ev in pull_model_stream(model):
            yield ev
            if ev.get("t") == "error":
                yield {"t": "error", "msg": ev.get("msg", "Model download failed")}
                return
            if ev.get("t") == "done" and not ev.get("ok"):
                yield {"t": "error", "msg": "Model download failed"}
                return
        yield {"t": "step", "id": "model", "state": "done", "text": "AI model ready"}
    else:
        if installed and not model_has(model, installed):
            model = installed[0]
        yield {"t": "step", "id": "model", "state": "done", "text": f"Using model {model}"}

    yield {"t": "step", "id": "config", "state": "start", "text": "Connecting Lamp…"}
    write_config(model)
    yield {"t": "step", "id": "config", "state": "done", "text": "All set"}

    mark_complete(skipped_voice=True)
    yield {"t": "done", "ok": True, "model": model}
    # Voice: optional later via Lamp Settings (no pip on first-run — unreliable for consumers)


def full_status() -> dict:
    recommended = pick_model()
    installed = list_ollama_models() if ollama_running()["ok"] else []
    has_model = model_has(recommended, installed) or any(installed)
    cfg = config_info()
    if cfg.get("model"):
        has_model = has_model or model_has(cfg["model"], installed)

    steps = {
        "python": python_info(),
        "lamp": lamp_info(),
        "tortoise": tortoise_info(),
        "ollama_installed": ollama_installed(),
        "ollama_running": ollama_running(),
        "model": {
            "ok": has_model,
            "recommended": recommended,
            "recommended_label": model_label(recommended),
            "installed": installed,
            "hint": None if has_model else f"We'll download {recommended} — one time, a few minutes.",
        },
        "config": config_info(),
        "voice": voice_info(),
    }

    required_ok = (
        steps["python"]["ok"]
        and steps["lamp"]["ok"]
        and steps["tortoise"]["ok"]
        and steps["ollama_installed"]["ok"]
        and steps["ollama_running"]["ok"]
        and steps["model"]["ok"]
        and steps["config"]["ok"]
    )

    complete_file = load_complete()
    wizard_done = bool(complete_file and complete_file.get("version") == SETUP_VERSION)

    return {
        "version": SETUP_VERSION,
        "platform": platform.system(),
        "ram_gb": round(ram_gb(), 1),
        "steps": steps,
        "ready": required_ok,
        "wizard_complete": wizard_done,
        "skip_wizard": wizard_done and required_ok,
    }


class Handler(BaseHTTPRequestHandler):
    server_version = "LampSetup/1.0"

    def log_message(self, fmt, *args):
        log(f"{self.address_string()} {fmt % args}")

    def _send_json(self, data: dict, status: int = 200):
        body = json.dumps(data).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def _read_json(self) -> dict:
        n = int(self.headers.get("Content-Length", 0))
        raw = self.rfile.read(n) if n else b"{}"
        return json.loads(raw.decode() or "{}")

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        path = self.path.split("?", 1)[0]
        if path == "/api/status":
            return self._send_json(full_status())
        if path in ("/", "/index.html"):
            return self._serve_file(SETUP_UI / "index.html", "text/html; charset=utf-8")
        if path == "/setup.css":
            return self._serve_file(SETUP_UI / "setup.css", "text/css; charset=utf-8")
        if path == "/setup.js":
            return self._serve_file(SETUP_UI / "setup.js", "application/javascript; charset=utf-8")
        self.send_error(404)

    def _serve_file(self, fp: Path, ctype: str):
        if not fp.is_file():
            self.send_error(404)
            return
        data = fp.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_POST(self):
        path = self.path.split("?", 1)[0]
        if path != "/api/action":
            self.send_error(404)
            return
        body = self._read_json()
        action = body.get("action", "")

        if action == "status":
            return self._send_json(full_status())
        if action == "ensure_tortoise":
            return self._send_json(ensure_tortoise())
        if action == "install_ollama":
            return self._send_json(install_ollama())
        if action == "start_ollama":
            return self._send_json(start_ollama())
        if action == "write_config":
            model = body.get("model") or pick_model()
            return self._send_json(write_config(model))
        if action == "install_voice":
            return self._send_json(install_voice())
        if action == "complete":
            mark_complete(skipped_voice=bool(body.get("skipped_voice")))
            return self._send_json({"ok": True, **full_status()})
        if action == "reset":
            clear_complete()
            return self._send_json({"ok": True})

        if action == "pull_model":
            model = body.get("model") or pick_model()
            self.send_response(200)
            self.send_header("Content-Type", "application/x-ndjson")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            for ev in pull_model_stream(model):
                self.wfile.write(json.dumps(ev).encode() + b"\n")
                self.wfile.flush()
            return

        if action == "bootstrap":
            self.send_response(200)
            self.send_header("Content-Type", "application/x-ndjson")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            for ev in bootstrap_stream():
                self.wfile.write(json.dumps(ev).encode() + b"\n")
                self.wfile.flush()
            return

        self._send_json({"ok": False, "message": f"unknown action: {action}"}, 400)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=DEFAULT_PORT)
    ap.add_argument("--lamp-root", default="")
    ap.add_argument("--bind", default="127.0.0.1")
    args = ap.parse_args()
    if args.lamp_root:
        os.environ["LAMP_ROOT"] = args.lamp_root
    httpd = ThreadingHTTPServer((args.bind, args.port), Handler)
    log(f"setup wizard http://{args.bind}:{args.port}/")
    httpd.serve_forever()


if __name__ == "__main__":
    main()
