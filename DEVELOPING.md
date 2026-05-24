# Developing Lamp Desktop

Electron wraps [Lamp](https://github.com/thebreadcat/lamp): it runs `lamp.py`, opens `http://127.0.0.1:7700` in a window, and runs first-boot setup via `scripts/setup-daemon.py`.

```
Electron (tray + window)
    → setup wizard (port 7701) on first launch
    → python lamp.py (port 7700)
    → Lamp PWA UI
```

## Clone and run

```bash
git clone https://github.com/thebreadcat/lamp-ai-desktop.git
cd lamp-ai-desktop
npm install
```

Point at a Lamp checkout (sibling repo or submodule):

```bash
export LAMP_PATH=/path/to/lamp   # contains lamp.py
npm run dev
```

Or let `ensure-lamp` find `../lamp` or clone Lamp from GitHub.

## Build installers

```bash
npm run build:mac    # dist/Lamp-*.dmg, *.zip
npm run build:win
npm run build:linux
```

`predist` runs: `ensure-lamp` → `icons` → `bundle-python` (embedded Python 3.12).

## Release

See [RELEASING.md](RELEASING.md). Tag `v*` pushes [`.github/workflows/release.yml`](.github/workflows/release.yml) to build all three platforms.

## macOS signing (TODO)

Unsigned builds trigger Gatekeeper **“damaged”** for end users. Fix: Apple Developer ID + `electron-builder` notarize. Until then, document `xattr -cr` in README.

Ad-hoc sign for local testing: `"mac": { "identity": "-" }` in `package.json`.

## Layout

| Path | Purpose |
|------|---------|
| `electron/` | Main process, tray, Lamp server spawn |
| `setup/` | First-run wizard UI |
| `scripts/setup-daemon.py` | Setup API (Ollama, model, config) |
| `scripts/ensure-lamp.py` | Stage Lamp + Tortoise for packaging |
| `scripts/bundle-python.mjs` | Embed python-build-standalone |
| `lamp/` | Staged at build time (gitignored) |

## Env vars

| Variable | Purpose |
|----------|---------|
| `LAMP_PATH` | Lamp repo root (dev) |
| `LAMP_PYTHON` | Override Python binary |
| `LAMP_PORT` | Lamp HTTP port (default `7700`) |
