# Releasing Lamp Desktop

## Do you build locally first?

**No.** The normal flow is:

1. Bump `package.json` and commit desktop changes on `main`
2. Push `main`, then push tag `v0.2.5` (must match `package.json`)
3. **GitHub Actions builds** macOS / Windows / Linux and attaches installers to the release

You only run `npm run build:mac` locally when **testing** before you tag. The DMG users download comes from CI, not from your laptop (unless you upload one manually).

Wait until the [Release workflow](https://github.com/thebreadcat/lamp-ai-desktop/actions) is green and the release is **published** (not Draft) before downloading.

## Release checklist

1. **Pull latest Lamp** (includes MemoMind, Workshop, and whatever is on `lamp-ai` main):
   ```bash
   python3 scripts/ensure-lamp.py
   ```
   CI clones `https://github.com/thebreadcat/lamp-ai.git` with submodules at tag time. Tortoise is cloned into the bundle if missing.

2. **Bump `version` in `package.json`** — this is what the app shows and what installer filenames use.

3. **Commit** desktop changes (updater, window fixes, etc.) and the staged `lamp/` tree if you commit it locally.

4. **Tag must match `package.json`** exactly (CI will fail otherwise):
   ```bash
   git tag v0.2.4
   git push origin main
   git push origin v0.2.4
   ```

5. **After CI finishes**, confirm the GitHub release assets are named with the new version (e.g. `Lamp-0.2.4-arm64.dmg`, not `0.2.2`).

6. **Verify on a packaged build** (not `npm run dev`):
   - Menu bar tray → **About Lamp…** shows desktop version + Lamp/Tortoise commit SHAs
   - Tray → **Check for updates…** (auto-update only works when installed from a release build)

### Why v0.2.3 showed as 0.2.2

The `v0.2.3` tag was pushed while `package.json` still said `0.2.2`, so the built app and DMG names were `0.2.2`. The updater compared `0.2.2` to `latest-mac.yml` (also `0.2.2`) and reported “up to date.” Fix: always bump `package.json` before tagging.

## What gets bundled

| Component | Source |
|-----------|--------|
| Desktop shell | This repo (`package.json` version) |
| Lamp UI + server | `lamp-ai` **main** at CI build time (`ensure-lamp.py`) |
| Tortoise | Cloned into `lamp/vendor/workshop/vendor/tortoise` |
| MemoMind | Shipped inside Lamp (`lamp-ai`); not a separate desktop pin |
| Font Awesome / CSS | `lamp/assets/fontawesome/` (verified before packaging) |
| Embedded Python | `bundle-python.mjs` (python-build-standalone 3.12) |

Pin a specific Lamp commit for a release: set `LAMP_REF` in the release workflow (defaults to `main`).

Build metadata is written to `resources/build-info.json` and shown in **About Lamp…**.

### Mind menu not visible?

Mind is in the mobile flyout but **hidden until MemoMind is enabled** for your account (same as web Lamp). Set up MemoMind in Lamp settings first; then **Mind** appears in the nav flyout.

### `all.min.css` or `/api/voice/status` 404?

Usually means the app is **not** serving the bundled `Resources/lamp` tree — often because a dev `LAMP_PATH` in your shell pointed at an old/incomplete checkout. Packaged builds now ignore `LAMP_PATH`. After installing a new build, **Quit** from the tray and reinstall. `/api/voice/status` requires you to be **logged in**; Whisper not installed is normal (mic still works, transcription may not).

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

1. `ensure-lamp` — stage Lamp + Tortoise + `.desktop-build-meta.json`
2. `icons` — `build/icon.icns`, `.ico`, `icons/`
3. `bundle-python` — embedded Python 3.12 in `resources/python/`
4. `write-build-info` — `resources/build-info.json` for About / diagnostics

## CI

Pushing tag `v*` triggers [.github/workflows/release.yml](.github/workflows/release.yml) (macOS, Windows, Linux). Unsigned macOS builds may need `xattr -cr` on the DMG and `/Applications/Lamp.app` — see README.

For production auto-update on macOS: Apple Developer signing + notarization (`CSC_*` secrets).

## Test the artifact

1. **Quit** any old Lamp from the menu bar (tray → Quit) before installing a new DMG.
2. Install from `dist/` or the GitHub release.
3. Tray → **About Lamp…** — version should match the release tag.
4. Tray → **Check for updates…** — should offer a newer build if one exists on GitHub.
