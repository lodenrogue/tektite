const { contextBridge, ipcRenderer, webUtils } = require("electron");

contextBridge.exposeInMainWorld("tektite", {
  chooseVault: () => ipcRenderer.invoke("vault:choose"),
  scanVault: (rootPath) => ipcRenderer.invoke("vault:scan", rootPath),
  readNote: (rootPath, relativePath) => ipcRenderer.invoke("note:read", rootPath, relativePath),
  writeNote: (rootPath, relativePath, content) =>
    ipcRenderer.invoke("note:write", rootPath, relativePath, content),
  createNote: (rootPath, requestedName, folder) =>
    ipcRenderer.invoke("note:create", rootPath, requestedName, folder),
  createFolder: (rootPath, requestedName, parentFolder) =>
    ipcRenderer.invoke("folder:create", rootPath, requestedName, parentFolder),
  deleteEntry: (rootPath, relativePath, type) =>
    ipcRenderer.invoke("entry:delete", rootPath, relativePath, type),
  moveEntry: (rootPath, relativePath, type, targetFolder) =>
    ipcRenderer.invoke("entry:move", rootPath, relativePath, type, targetFolder),
  importImage: (rootPath, sourcePath, targetFolder) =>
    ipcRenderer.invoke("asset:import-image", rootPath, sourcePath, targetFolder),
  getFilePath: (file) => webUtils.getPathForFile(file),
  onOpenVault: (callback) => ipcRenderer.on("menu:open-vault", callback),
  onNewNote: (callback) => ipcRenderer.on("menu:new-note", callback)
});
