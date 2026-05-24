# Releasing Lamp Desktop

## Version bump

Edit `version` in `package.json`, then tag:

```bash
git push origin main
git tag v0.2.0   # if not already tagged
git push origin v0.2.0
```

Pushing tag `v*` triggers [.github/workflows/release.yml](.github/workflows/release.yml) on GitHub Actions (all three OSes).

**Local mac build already done?** After CI finishes, upload `dist/Lamp-0.2.0-arm64.dmg` to the release if you built before CI, or rely on the macOS job artifact.

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

No secrets required for unsigned/ad-hoc builds. **macOS testers** may see “damaged” until we add Apple Developer signing + notarization — not a bad upload; see README troubleshooting (`xattr -cr`).

For production: `CSC_LINK` / Apple notarize credentials in GitHub secrets.

## Test the artifact

1. Install from `dist/`
2. First launch runs automatic setup (Ollama + model)
3. Create account in Lamp UI
