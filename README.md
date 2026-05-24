# Lamp Desktop

Cross-platform desktop launcher for [Lamp](https://github.com/thebreadcat/lamp) — starts the local Lamp server, opens the UI in a native window, and packages installers for **macOS**, **Windows**, and **Linux**.

Lamp itself lives in a separate repo. This project vendors it as a **git submodule** at `lamp/` and bundles it into release builds.

## Architecture

```
┌─────────────────────────────────────┐
│  Lamp Desktop (Electron shell)      │
│  • window / tray                    │
│  • spawns & monitors Python server  │
└──────────────┬──────────────────────┘
               │ http://127.0.0.1:7700
┌──────────────▼──────────────────────┐
│  lamp/  (git submodule)             │
│  python3 lamp.py                    │
└─────────────────────────────────────┘
```

### One-time automatic setup

On first launch, Lamp shows a **single progress screen** and installs everything automatically — no buttons to click:

1. **Python** — bundled inside release builds (`npm run bundle-python`); dev uses system `python3`
2. **Tortoise** — included in the packaged Lamp tree at build time
3. **Ollama** — installed via official script (Mac/Linux) or winget (Windows), with retries
4. **AI model** — downloads the best fit for your RAM (`qwen2.5:7b` / `3b` / `1.5b`), or uses one you already have
5. **Config** — writes `~/.workshop/config.json` wired to Ollama
6. **Voice** — Whisper/ffmpeg install **in the background** after Lamp opens (optional)

If something can't be automated (rare), you'll see one clear message and a **Try again** button. **Run setup again…** in the tray menu re-runs the pipeline.

**Release builds** (`npm run build:mac` etc.) bundle Python + Lamp + Tortoise so users don't install those separately. They still need Ollama (installed automatically on first run when possible).

## Publishing this repo (first time)

```bash
cd lamp-desktop
git init
git submodule add https://github.com/thebreadcat/lamp.git lamp
git add .
git commit -m "Initial lamp-desktop launcher"
git remote add origin git@github.com:thebreadcat/lamp-desktop.git
git push -u origin main
```

If the Lamp repo is private, use SSH for the submodule URL in `.gitmodules`.

## Quick start (development)

```bash
git clone --recurse-submodules https://github.com/thebreadcat/lamp-desktop.git
cd lamp-desktop
./scripts/ensure-lamp.sh
npm install
npm run dev
```

**Without submodule** (sibling checkout or monorepo layout):

```bash
export LAMP_PATH=/path/to/lamp   # folder that contains lamp.py
npm install
npm run dev
```

If `lamp/` is missing, `ensure-lamp` auto-detects a sibling checkout at `../lamp` (e.g. `prototypes/lamp` next to `prototypes/lamp-desktop`) and **stages** it into `lamp/` for installers. Re-run is skipped until the source path changes.

Optional: `ln -s ../lamp lamp` for dev only (build still stages a full copy).

## Build installers

Requires Node 20+ and platform tools (see [Electron Builder](https://www.electron.build/multi-platform-build)):

| Platform | Command | Output |
|----------|---------|--------|
| macOS | `npm run build:mac` | `dist/Lamp-*.dmg` |
| Windows | `npm run build:win` | `dist/Lamp-*-setup.exe` |
| Linux | `npm run build:linux` | `dist/Lamp-*.AppImage`, `dist/*.deb` |

CI: `.github/workflows/release.yml` builds all three on tag push.

## Repo layout

| Path | Purpose |
|------|---------|
| `lamp/` | Git submodule → [thebreadcat/lamp](https://github.com/thebreadcat/lamp) |
| `electron/` | Main process, tray, window |
| `scripts/ensure-lamp.py` | Submodule, Tortoise, preflight |
| `scripts/ensure-lamp.sh` | Shell wrapper for ensure script |

## Configuration

| Variable | Purpose |
|----------|---------|
| `LAMP_PATH` | Override path to Lamp repo (dev) |
| `LAMP_PYTHON` | Python executable (default `python3`) |
| `LAMP_PORT` | HTTP port (default `7700`) |

User data stays in `~/.workshop/` (Lamp’s normal paths).

## License

[Lamp License](LICENSE) — same terms as Lamp.
