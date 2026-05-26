const {
  app,
  BrowserWindow,
  Tray,
  Menu,
  shell,
  nativeImage,
} = require("electron");
const path = require("node:path");
const { loadIcon } = require("./app-icon");
const { LampServer } = require("./lamp-server");
const { SetupManager } = require("./setup-manager");
const { runSetupWindow } = require("./setup-window");

let mainWindow = null;
let tray = null;
let quitting = false;
const lamp = new LampServer(app);
const setup = new SetupManager(app);

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

function buildTray() {
  const img = loadIcon({ tray: true });
  tray = new Tray(
    img.isEmpty()
      ? nativeImage.createFromDataURL(
          "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
        )
      : img
  );
  tray.setToolTip("Lamp");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: "Open Lamp",
        click: () => {
          if (mainWindow) mainWindow.show();
          else createMainWindow();
        },
      },
      {
        label: "Open in browser",
        click: async () => {
          const url = await lamp.start();
          shell.openExternal(url);
        },
      },
      { type: "separator" },
      {
        label: "Run setup again…",
        click: async () => {
          await setup.resetWizard();
          await runSetupWindow(setup);
          if (mainWindow) {
            mainWindow.loadURL(await lamp.start());
          }
        },
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

async function createMainWindow() {
  const url = await lamp.start();
  const icon = loadIcon();
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 900,
    minHeight: 600,
    title: "Lamp",
    icon: icon.isEmpty() ? undefined : icon,
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
    if (
      target.startsWith("http://127.0.0.1") ||
      target.startsWith("http://localhost")
    ) {
      return { action: "allow" };
    }
    shell.openExternal(target);
    return { action: "deny" };
  });
}

app.whenReady().then(async () => {
  if (process.platform === "darwin") {
    const dockIcon = loadIcon();
    if (!dockIcon.isEmpty()) app.dock.setIcon(dockIcon);
  }
  buildTray();
  try {
    if (await setup.needsWizard()) {
      await runSetupWindow(setup);
    }
  } catch (e) {
    console.error("[setup] wizard failed:", e);
  }
  await createMainWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
    else if (mainWindow) mainWindow.show();
  });
});

app.on("window-all-closed", () => {
  // Keep running in tray until explicit Quit
});

app.on("before-quit", () => {
  quitting = true;
  lamp.stop();
  setup.stop();
});
