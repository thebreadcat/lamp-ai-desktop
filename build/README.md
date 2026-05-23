# Build assets

Place platform icons here before `npm run build`:

| File | Platform |
|------|----------|
| `icon.png` | Source (512×512 recommended) |
| `icon.icns` | macOS |
| `icon.ico` | Windows |
| `icons/` | Linux (e.g. 256x256.png, 128x128.png, …) |

From the Lamp repo (after submodule init):

```bash
cp ../lamp/assets/favicon.svg icon.svg
# Then convert with your tool of choice, e.g.:
# npx @aspect-ratio/svg-to-png icon.svg icon.png
```

Dev mode works without icons (placeholder tray image).
