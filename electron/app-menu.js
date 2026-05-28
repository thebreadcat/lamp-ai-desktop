const { app, Menu, dialog } = require("electron");
const { readBuildInfo, formatAboutDetail, shortSha } = require("./build-info");

function componentVersionLine() {
  const info = readBuildInfo();
  const parts = [];
  if (info?.lampCommit) parts.push(`Lamp ${shortSha(info.lampCommit)}`);
  if (info?.tortoiseCommit) parts.push(`Tortoise ${shortSha(info.tortoiseCommit)}`);
  return parts.join(" · ") || null;
}

function configureAboutPanel() {
  if (process.platform !== "darwin") return;
  const year = new Date().getFullYear();
  app.setAboutPanelOptions({
    applicationName: "Lamp",
    applicationVersion: app.getVersion(),
    version: componentVersionLine() || undefined,
    copyright: `Copyright © ${year} thebreadcat`,
    credits: formatAboutDetail(),
  });
}

async function showAboutDialog() {
  await dialog.showMessageBox({
    type: "info",
    title: "About Lamp",
    message: `Lamp ${app.getVersion()}`,
    detail: formatAboutDetail(),
  });
}

function updateStatusLabel(updater) {
  if (!updater) return "Check for Updates…";
  if (updater.state.downloading) {
    return `Downloading update… ${updater.state.progressPercent}%`;
  }
  if (updater.state.checking) return "Checking for updates…";
  if (updater.state.updateReady) return "Restart to install update";
  return "Check for Updates…";
}

function buildMenuTemplate({ getUpdater }) {
  const checkForUpdates = {
    id: "check-for-updates",
    label: updateStatusLabel(getUpdater()),
    enabled: getUpdater() ? !getUpdater().state.checking : true,
    click: async () => {
      const updater = getUpdater();
      if (updater) await updater.checkForUpdates({ manual: true });
    },
  };

  const aboutItem =
    process.platform === "darwin"
      ? { role: "about" }
      : {
          label: "About Lamp…",
          click: () => {
            showAboutDialog().catch((e) =>
              console.error("[menu] about failed:", e)
            );
          },
        };

  const appMenu =
    process.platform === "darwin"
      ? {
          label: app.name,
          submenu: [
            aboutItem,
            checkForUpdates,
            { type: "separator" },
            { role: "services" },
            { type: "separator" },
            { role: "hide" },
            { role: "hideOthers" },
            { role: "unhide" },
            { type: "separator" },
            { role: "quit" },
          ],
        }
      : null;

  const helpMenu =
    process.platform === "darwin"
      ? null
      : {
          label: "Help",
          submenu: [aboutItem, checkForUpdates],
        };

  const editMenu = {
    label: "Edit",
    submenu: [
      { role: "undo" },
      { role: "redo" },
      { type: "separator" },
      { role: "cut" },
      { role: "copy" },
      { role: "paste" },
      { role: "selectAll" },
    ],
  };

  const windowMenu = {
    label: "Window",
    submenu: [{ role: "minimize" }, { role: "close" }],
  };

  const template = [];
  if (appMenu) template.push(appMenu);
  template.push(editMenu, windowMenu);
  if (helpMenu) template.push(helpMenu);
  return template;
}

function installApplicationMenu({ getUpdater }) {
  const menu = Menu.buildFromTemplate(buildMenuTemplate({ getUpdater }));
  Menu.setApplicationMenu(menu);
  return menu;
}

function refreshApplicationMenu({ getUpdater }) {
  installApplicationMenu({ getUpdater });
}

module.exports = {
  configureAboutPanel,
  showAboutDialog,
  installApplicationMenu,
  refreshApplicationMenu,
};
