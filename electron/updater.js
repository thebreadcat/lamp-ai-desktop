const { app, dialog } = require("electron");
const { autoUpdater } = require("electron-updater");

const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

function createUpdater({ onStateChange } = {}) {
  const state = {
    checking: false,
    downloading: false,
    updateReady: false,
    progressPercent: 0,
  };
  let interval = null;
  let manualCheck = false;

  const emit = () => {
    if (typeof onStateChange === "function") onStateChange({ ...state });
  };

  const canUseUpdater = () => app.isPackaged;

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("checking-for-update", () => {
    state.checking = true;
    emit();
  });

  autoUpdater.on("update-not-available", async () => {
    state.checking = false;
    state.downloading = false;
    state.progressPercent = 0;
    emit();
    if (manualCheck) {
      manualCheck = false;
      await dialog.showMessageBox({
        type: "info",
        title: "Lamp is up to date",
        message: `You already have the latest version (${app.getVersion()}).`,
      });
    }
  });

  autoUpdater.on("update-available", async (info) => {
    state.checking = false;
    emit();
    const result = await dialog.showMessageBox({
      type: "info",
      title: "Update available",
      message: `Lamp ${info.version} is available.`,
      detail: "Download now? You can keep using Lamp while it downloads.",
      buttons: ["Download update", "Later"],
      defaultId: 0,
      cancelId: 1,
    });
    manualCheck = false;
    if (result.response === 0) autoUpdater.downloadUpdate();
  });

  autoUpdater.on("download-progress", (progress) => {
    state.downloading = true;
    state.progressPercent = Math.max(0, Math.round(progress.percent || 0));
    emit();
  });

  autoUpdater.on("update-downloaded", async (info) => {
    state.downloading = false;
    state.updateReady = true;
    state.progressPercent = 100;
    emit();
    const result = await dialog.showMessageBox({
      type: "info",
      title: "Update ready",
      message: `Lamp ${info.version} has been downloaded.`,
      detail: "Restart now to install the update?",
      buttons: ["Restart now", "Later"],
      defaultId: 0,
      cancelId: 1,
    });
    if (result.response === 0) {
      setImmediate(() => autoUpdater.quitAndInstall());
    }
  });

  autoUpdater.on("error", async (err) => {
    state.checking = false;
    state.downloading = false;
    state.progressPercent = 0;
    emit();
    const message = err?.message || String(err);
    console.error("[updater]", message);
    if (manualCheck) {
      manualCheck = false;
      await dialog.showMessageBox({
        type: "error",
        title: "Update check failed",
        message: "Lamp could not check for updates.",
        detail: message,
      });
    }
  });

  async function checkForUpdates({ manual = false } = {}) {
    if (!canUseUpdater()) {
      if (manual) {
        await dialog.showMessageBox({
          type: "info",
          title: "Updates in development mode",
          message: "Auto-update works only in packaged builds.",
        });
      }
      return;
    }
    manualCheck = manual;
    await autoUpdater.checkForUpdates();
  }

  function startPeriodicChecks() {
    if (!canUseUpdater()) return;
    setTimeout(() => {
      checkForUpdates({ manual: false }).catch((e) =>
        console.error("[updater] periodic check failed:", e)
      );
    }, 30_000);
    interval = setInterval(() => {
      checkForUpdates({ manual: false }).catch((e) =>
        console.error("[updater] periodic check failed:", e)
      );
    }, CHECK_INTERVAL_MS);
  }

  function stop() {
    if (interval) clearInterval(interval);
  }

  return { state, checkForUpdates, startPeriodicChecks, stop };
}

module.exports = { createUpdater };
