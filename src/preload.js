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
  renameEntry: (rootPath, relativePath, type, requestedName) =>
    ipcRenderer.invoke("entry:rename", rootPath, relativePath, type, requestedName),
  moveEntry: (rootPath, relativePath, type, targetFolder) =>
    ipcRenderer.invoke("entry:move", rootPath, relativePath, type, targetFolder),
  importImage: (rootPath, sourcePath, targetFolder) =>
    ipcRenderer.invoke("asset:import-image", rootPath, sourcePath, targetFolder),
  readAssetDataUrl: (rootPath, relativePath) =>
    ipcRenderer.invoke("asset:read-data-url", rootPath, relativePath),
  setVaultWindowTitle: (vaultName) => ipcRenderer.invoke("window:set-vault-name", vaultName),
  syncGit: (rootPath) => ipcRenderer.invoke("git:sync", rootPath),
  loadWorkspaceState: (rootPath) => ipcRenderer.invoke("workspace:load", rootPath),
  saveWorkspaceState: (rootPath, workspace) => ipcRenderer.invoke("workspace:save", rootPath, workspace),
  getFilePath: (file) => webUtils.getPathForFile(file),
  onOpenVault: (callback) => ipcRenderer.on("menu:open-vault", callback),
  onOpenRecentVault: (callback) =>
    ipcRenderer.on("menu:open-recent-vault", (_event, rootPath) => callback(rootPath)),
  onNewNote: (callback) => ipcRenderer.on("menu:new-note", callback),
  onCloseTab: (callback) => ipcRenderer.on("menu:close-tab", callback),
  onCloseAllTabs: (callback) => ipcRenderer.on("menu:close-all-tabs", callback),
  onRefreshVault: (callback) => ipcRenderer.on("menu:refresh-vault", callback),
  onToggleFileSuffixes: (callback) => ipcRenderer.on("menu:toggle-file-suffixes", callback),
  onToggleTheme: (callback) => ipcRenderer.on("menu:toggle-theme", callback),
  onToggleTagsPane: (callback) => ipcRenderer.on("menu:toggle-tags-pane", callback),
  onToggleGraphPane: (callback) => ipcRenderer.on("menu:toggle-graph-pane", callback),
  onGitSyncOutput: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on("git:sync-output", listener);
    return () => ipcRenderer.removeListener("git:sync-output", listener);
  }
});
