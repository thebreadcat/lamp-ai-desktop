const { BrowserWindow, ipcMain } = require("electron");
const path = require("node:path");

function runSetupWindow(setupManager) {
  return new Promise((resolve) => {
    const url = `${setupManager.baseUrl}/`;

    const win = new BrowserWindow({
      width: 560,
      height: 720,
      minWidth: 480,
      minHeight: 600,
      title: "Set up Lamp",
      backgroundColor: "#0f0f12",
      resizable: true,
      webPreferences: {
        preload: path.join(__dirname, "preload-setup.js"),
        nodeIntegration: false,
        contextIsolation: true,
      },
    });

    const done = () => {
      if (!win.isDestroyed()) win.close();
      resolve();
    };

    const channel = "setup-complete";
    ipcMain.removeAllListeners(channel);
    ipcMain.once(channel, done);
    win.on("closed", () => {
      ipcMain.removeListener(channel, done);
      resolve();
    });

    win.loadURL(url);
  });
}

module.exports = { runSetupWindow };
