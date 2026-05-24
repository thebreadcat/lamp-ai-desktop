# Releasing Lamp Desktop

## Version bump

Edit `version` in `package.json`, then tag:

```bash
git tag v0.2.0
git push origin main --tags
```

GitHub Actions builds **macOS**, **Windows**, and **Linux** and attaches installers to the GitHub Release.

## Manual build (one platform)

```bash
npm ci
npm run build:mac    # or build:win / build:linux on that OS
```

Outputs in `dist/`:

| OS | Files |
|----|--------|
| macOS | `Lamp-<version>-arm64.dmg`, `.zip` |
| Windows | `Lamp Setup <version>.exe` |
| Linux | `.AppImage`, `.deb` |

## What `predist` does

1. `ensure-lamp` — stage Lamp + Tortoise (clone from GitHub in CI)
2. `icons` — `build/icon.icns`, `.ico`, `icons/`
3. `bundle-python` — embedded Python 3.12 in `resources/python/`

## CI secrets

No secrets required for unsigned builds. For signed macOS/Windows, add certificates later.

## Test the artifact

1. Install from `dist/`
2. First launch runs automatic setup (Ollama + model)
3. Create account in Lamp UI
