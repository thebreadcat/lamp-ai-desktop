const { app, nativeImage } = require("electron");
const fs = require("node:fs");
const path = require("node:path");

/** Resolve an on-disk icon for tray, dock, and window chrome. */
function iconPath() {
  const candidates = [];

  if (app.isPackaged) {
    const res = process.resourcesPath;
    if (process.platform === "darwin") {
      candidates.push(path.join(res, "icon.icns"));
    }
    if (process.platform === "win32") {
      candidates.push(path.join(res, "icon.ico"));
    }
    candidates.push(
      path.join(res, "app-icon.png"),
      path.join(res, "icons", "32x32.png"),
      path.join(res, "icons", "64x64.png")
    );
  } else {
    const base = path.join(__dirname, "..", "build");
    if (process.platform === "darwin") {
      candidates.push(path.join(base, "icon.icns"));
    }
    if (process.platform === "win32") {
      candidates.push(path.join(base, "icon.ico"));
    }
    candidates.push(
      path.join(base, "icons", "32x32.png"),
      path.join(base, "icon.png")
    );
  }

  return candidates.find((p) => fs.existsSync(p));
}

function loadIcon({ tray = false } = {}) {
  const p = iconPath();
  if (!p) return nativeImage.createEmpty();
  let img = nativeImage.createFromPath(p);
  if (tray && process.platform === "darwin" && !img.isEmpty()) {
    img = img.resize({ width: 22, height: 22 });
  }
  return img;
}

module.exports = { iconPath, loadIcon };
