const {
  app,
  BrowserWindow,
  Tray,
  Menu,
  shell,
  nativeImage,
} = require("electron");
const path = require("node:path");
const { LampServer } = require("./lamp-server");

let mainWindow = null;
let tray = null;
let quitting = false;
const lamp = new LampServer(app);

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

function iconPath() {
  const base = path.join(__dirname, "..", "build");
  if (process.platform === "darwin") {
    const icns = path.join(base, "icon.icns");
    if (require("node:fs").existsSync(icns)) return icns;
  }
  const png = path.join(base, "icon.png");
  return require("node:fs").existsSync(png) ? png : undefined;
}

function buildTray() {
  const img = iconPath()
    ? nativeImage.createFromPath(iconPath())
    : nativeImage.createEmpty();
  tray = new Tray(img.isEmpty() ? nativeImage.createFromDataURL(
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
  ) : img);
  tray.setToolTip("Lamp");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: "Open Lamp",
        click: () => {
          if (mainWindow) mainWindow.show();
          else createWindow();
        },
      },
      {
        label: "Open in browser",
        click: () => shell.openExternal(lamp.baseUrl),
      },
      { type: "separator" },
      {
        label: "Quit",
        click: () => {
          quitting = true;
          app.quit();
        },
      },
    ])
  );
  tray.on("double-click", () => {
    if (mainWindow) mainWindow.show();
  });
}

async function createWindow() {
  const url = await lamp.start();
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 900,
    minHeight: 600,
    title: "Lamp",
    backgroundColor: "#0f0f12",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });
  mainWindow.loadURL(url);
  mainWindow.on("close", (e) => {
    if (!quitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
  mainWindow.webContents.setWindowOpenHandler(({ url: target }) => {
    if (target.startsWith("http://127.0.0.1") || target.startsWith("http://localhost")) {
      return { action: "allow" };
    }
    shell.openExternal(target);
    return { action: "deny" };
  });
}

app.whenReady().then(async () => {
  buildTray();
  await createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
    else if (mainWindow) mainWindow.show();
  });
});

app.on("window-all-closed", () => {
  // Keep running in tray until explicit Quit
});

app.on("before-quit", () => {
  quitting = true;
  lamp.stop();
});
