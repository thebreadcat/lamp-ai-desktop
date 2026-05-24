const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("lampSetupComplete", () => {
  ipcRenderer.send("setup-complete");
});
