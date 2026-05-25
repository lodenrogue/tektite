const { app, BrowserWindow, dialog, ipcMain, Menu, nativeImage } = require("electron");
const { spawn } = require("node:child_process");
const fs = require("node:fs/promises");
const path = require("node:path");

let mainWindow;
let aboutWindow;
let splashWindow;
let splashShownAt = 0;
let recentVaults = [];
const tektiteWindows = new Set();
const verbose = process.env.TEKTITE_VERBOSE === "1" || process.env.DEBUG?.includes("tektite");
const appIconPath = path.join(__dirname, "..", "assets", "app", "tektive-icon.webp");
const fallbackAppIconPath = path.join(__dirname, "..", "assets", "icons", "tektite-icon.png");
const imageExtensions = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".avif"]);
const gitExecutableCandidates = [
  "/usr/bin/git",
  "/bin/git",
  "/usr/local/bin/git",
  "/opt/homebrew/bin/git"
];
const gitSafePath = "/usr/bin:/bin:/usr/local/bin:/opt/homebrew/bin";
const splashMinimumMs = 5000;
const recentVaultLimit = 10;

app.name = "Tektite";
app.setName("Tektite");

function log(...args) {
  if (verbose) console.log("[tektite:main]", ...args);
}

function createWindow(options = {}) {
  const shouldShowImmediately = options.show !== false;
  const appIcon = loadAppIcon();
  const window = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 980,
    minHeight: 640,
    title: "Tektite",
    icon: appIcon,
    show: shouldShowImmediately,
    backgroundColor: "#f7f4ed",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow = window;
  tektiteWindows.add(window);
  buildMenu();

  window.loadFile(path.join(__dirname, "renderer", "index.html"), {
    query: {
      restoreLastVault: options.restoreLastVault === false ? "0" : "1"
    }
  });
  window.once("ready-to-show", () => {
    if (splashWindow && !splashWindow.isDestroyed()) {
      const elapsed = Date.now() - splashShownAt;
      setTimeout(() => {
        if (splashWindow && !splashWindow.isDestroyed()) splashWindow.close();
        splashWindow = null;
        if (!window.isDestroyed()) window.show();
      }, Math.max(0, splashMinimumMs - elapsed));
    } else if (!shouldShowImmediately && !window.isDestroyed()) {
      window.show();
    }
  });

  window.on("focus", () => {
    mainWindow = window;
    buildMenu();
  });

  window.on("closed", () => {
    tektiteWindows.delete(window);
    if (mainWindow === window) mainWindow = [...tektiteWindows][0] || null;
    buildMenu();
  });

  if (process.platform === "darwin" && app.dock) {
    app.dock.setIcon(appIcon);
  }

  return window;
}

function createSplashWindow() {
  splashShownAt = Date.now();
  splashWindow = new BrowserWindow({
    width: 520,
    height: 520,
    frame: false,
    resizable: false,
    movable: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    center: true,
    title: "Tektite",
    icon: loadAppIcon(),
    backgroundColor: "#ffffff",
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  splashWindow.loadFile(path.join(__dirname, "splash.html"), {
    query: { version: app.getVersion() }
  });
  splashWindow.once("ready-to-show", () => {
    if (splashWindow && !splashWindow.isDestroyed()) splashWindow.show();
  });
  splashWindow.on("closed", () => {
    splashWindow = null;
  });
}

function showAboutWindow() {
  if (aboutWindow && !aboutWindow.isDestroyed()) {
    aboutWindow.focus();
    return;
  }

  aboutWindow = new BrowserWindow({
    width: 420,
    height: 520,
    resizable: false,
    minimizable: false,
    maximizable: false,
    title: "About Tektite",
    parent: activeTektiteWindow() || undefined,
    modal: false,
    icon: loadAppIcon(),
    backgroundColor: "#111318",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  aboutWindow.setMenuBarVisibility(false);
  aboutWindow.loadFile(path.join(__dirname, "about.html"), {
    query: { version: app.getVersion() }
  });
  aboutWindow.on("closed", () => {
    aboutWindow = null;
  });
}

function activeTektiteWindow() {
  const focusedWindow = BrowserWindow.getFocusedWindow();
  if (focusedWindow && tektiteWindows.has(focusedWindow)) return focusedWindow;
  return mainWindow || [...tektiteWindows][0] || null;
}

function sendToActiveWindow(channel, ...args) {
  activeTektiteWindow()?.webContents.send(channel, ...args);
}

function sendToWindowOrCreate(channel, ...args) {
  const window = activeTektiteWindow();
  if (window && !window.isDestroyed()) {
    window.webContents.send(channel, ...args);
    return;
  }

  const newWindow = createWindow({ restoreLastVault: false });
  newWindow.webContents.once("did-finish-load", () => {
    if (!newWindow.isDestroyed()) newWindow.webContents.send(channel, ...args);
  });
}

async function openRecentVaultFromMenu(vaultPath) {
  const validation = await validateVaultRoot(vaultPath);
  if (!validation.ok) return;
  sendToWindowOrCreate("menu:open-recent-vault", vaultPath);
}

function loadAppIcon() {
  const icon = nativeImage.createFromPath(appIconPath);
  if (!icon.isEmpty()) return icon;
  return nativeImage.createFromPath(fallbackAppIconPath);
}

async function loadRecentVaults() {
  try {
    const raw = await fs.readFile(recentVaultsPath(), "utf8");
    const parsed = JSON.parse(raw);
    recentVaults = Array.isArray(parsed)
      ? parsed.filter((value) => typeof value === "string").slice(0, recentVaultLimit)
      : [];
  } catch {
    recentVaults = [];
  }
}

async function rememberRecentVault(rootPath) {
  const normalized = path.resolve(rootPath);
  recentVaults = [
    normalized,
    ...recentVaults.filter((vaultPath) => path.resolve(vaultPath) !== normalized)
  ].slice(0, recentVaultLimit);

  await fs.mkdir(path.dirname(recentVaultsPath()), { recursive: true });
  await fs.writeFile(recentVaultsPath(), JSON.stringify(recentVaults, null, 2), "utf8");
  buildMenu();
}

function recentVaultsPath() {
  return path.join(app.getPath("userData"), "recent-vaults.json");
}

async function validateVaultRoot(rootPath, sender) {
  let stat;
  try {
    stat = await fs.stat(rootPath);
  } catch (error) {
    if (error?.code === "ENOENT") {
      return showVaultUnavailableDialog(sender, rootPath);
    }
    throw error;
  }

  if (!stat.isDirectory()) {
    return showVaultUnavailableDialog(sender, rootPath);
  }

  return { ok: true };
}

async function showVaultUnavailableDialog(sender, rootPath) {
  const owner = sender ? BrowserWindow.fromWebContents(sender) : activeTektiteWindow();
  const message = "The vault folder doesn't exist anymore.";
  await dialog.showMessageBox(owner || undefined, {
    type: "warning",
    title: "Vault Folder Not Found",
    message,
    detail: `Tektite tried to open:\n${rootPath}`,
    buttons: ["OK"],
    defaultId: 0,
    noLink: true
  });

  return {
    ok: false,
    code: "VAULT_NOT_FOUND",
    message,
    path: rootPath
  };
}

function workspaceStatePath() {
  return path.join(app.getPath("userData"), "workspace-state.json");
}

async function loadWorkspaceStore() {
  try {
    const raw = await fs.readFile(workspaceStatePath(), "utf8");
    const parsed = JSON.parse(raw);
    return {
      lastVault: typeof parsed.lastVault === "string" ? parsed.lastVault : null,
      workspaces: parsed.workspaces && typeof parsed.workspaces === "object" ? parsed.workspaces : {}
    };
  } catch {
    return { lastVault: null, workspaces: {} };
  }
}

async function saveWorkspaceStore(store) {
  await fs.mkdir(path.dirname(workspaceStatePath()), { recursive: true });
  await fs.writeFile(workspaceStatePath(), JSON.stringify(store, null, 2), "utf8");
}

function buildMenu() {
  const isMac = process.platform === "darwin";
  const recentVaultItems = recentVaults.length > 0
    ? recentVaults.map((vaultPath) => ({
        label: path.basename(vaultPath) || vaultPath,
        sublabel: vaultPath,
        click: () => openRecentVaultFromMenu(vaultPath)
      }))
    : [{ label: "No Recent Vaults", enabled: false }];
  const template = [
    ...(isMac
      ? [
          {
            label: "Tektite",
            submenu: [
              { label: "About Tektite", click: showAboutWindow },
              { type: "separator" },
              { role: "services" },
              { type: "separator" },
              { role: "hide" },
              { role: "hideOthers" },
              { role: "unhide" },
              { type: "separator" },
              { role: "quit" }
            ]
          }
        ]
      : []),
    {
      label: "File",
      submenu: [
        {
          label: "New Window",
          accelerator: "CmdOrCtrl+N",
          click: () => createWindow({ restoreLastVault: false })
        },
        { type: "separator" },
        {
          label: "Open Vault...",
          accelerator: "CmdOrCtrl+O",
          click: () => sendToWindowOrCreate("menu:open-vault")
        },
        {
          label: "Recent Vaults...",
          submenu: recentVaultItems
        },
        { type: "separator" },
        {
          label: "New Node",
          accelerator: "CmdOrCtrl+Shift+N",
          click: () => sendToActiveWindow("menu:new-note")
        },
        { type: "separator" },
        {
          label: "Close Tab",
          accelerator: "CmdOrCtrl+W",
          click: () => sendToActiveWindow("menu:close-tab")
        },
        {
          label: "Close All Tabs",
          click: () => sendToActiveWindow("menu:close-all-tabs")
        },
        {
          label: "Close Window",
          accelerator: "Shift+CmdOrCtrl+W",
          click: () => activeTektiteWindow()?.close()
        },
        ...(isMac ? [] : [{ type: "separator" }, { role: "quit" }])
      ]
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" }
      ]
    },
    {
      label: "View",
      submenu: [
        {
          label: "Refresh Vault",
          accelerator: "CmdOrCtrl+R",
          click: () => sendToActiveWindow("menu:refresh-vault")
        },
        { type: "separator" },
        {
          label: "Show/Hide File Suffixes",
          click: () => sendToActiveWindow("menu:toggle-file-suffixes")
        },
        {
          label: "Toggle Dark/Light Mode",
          click: () => sendToActiveWindow("menu:toggle-theme")
        },
        {
          label: "Show/Hide Tags Pane",
          click: () => sendToActiveWindow("menu:toggle-tags-pane")
        },
        {
          label: "Show/Hide Graph Pane",
          click: () => sendToActiveWindow("menu:toggle-graph-pane")
        },
        { type: "separator" },
        { role: "toggleDevTools" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" }
      ]
    },
    {
      label: "Window",
      submenu: windowMenuItems(isMac)
    },
    ...(isMac
      ? []
      : [
          {
            label: "Help",
            submenu: [{ label: "About Tektite", click: showAboutWindow }]
          }
        ])
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function windowMenuItems(isMac) {
  const windows = [...tektiteWindows].filter((window) => !window.isDestroyed());
  const focusedWindow = activeTektiteWindow();
  const windowItems = windows.map((window) => ({
    type: "checkbox",
    label: windowMenuLabel(window),
    checked: window === focusedWindow,
    click: () => focusTektiteWindow(window)
  }));

  return [
    { role: "minimize" },
    isMac
      ? { role: "zoom" }
      : {
          label: "Maximize",
          click: () => toggleMaximize(activeTektiteWindow())
        },
    ...(isMac ? [{ type: "separator" }, { role: "front" }] : []),
    { type: "separator" },
    ...(windowItems.length > 0 ? windowItems : [{ label: "No Windows", enabled: false }])
  ];
}

function windowMenuLabel(window) {
  const vaultName = window.vaultName || window.getTitle() || "Tektite";
  return vaultName;
}

function focusTektiteWindow(window) {
  if (!window || window.isDestroyed()) return;
  if (window.isMinimized()) window.restore();
  window.show();
  window.focus();
}

function toggleMaximize(window) {
  if (!window || window.isDestroyed()) return;
  if (window.isMaximized()) window.unmaximize();
  else window.maximize();
}

app.on("ready", async () => {
  app.setName("Tektite");
  await loadRecentVaults();
  buildMenu();
  createSplashWindow();
  createWindow({ show: false });

  app.on("activate", () => {
    if (tektiteWindows.size === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

ipcMain.handle("vault:choose", async () => {
  log("vault:choose start");
  const result = await dialog.showOpenDialog(activeTektiteWindow() || undefined, {
    title: "Open Tektite Vault",
    properties: ["openDirectory"]
  });

  if (result.canceled || result.filePaths.length === 0) {
    log("vault:choose canceled");
    return null;
  }
  log("vault:choose selected", result.filePaths[0]);
  return result.filePaths[0];
});

ipcMain.handle("vault:scan", async (_event, rootPath) => {
  log("vault:scan start", rootPath);
  assertInsideVault(rootPath, rootPath);
  const validation = await validateVaultRoot(rootPath, _event.sender);
  if (!validation.ok) return validation;

  const tree = await readDirectory(rootPath, rootPath);
  const notes = flattenNotes(tree);
  const hasGitRepo = await hasGitRepository(rootPath);
  const gitProvider = hasGitRepo ? await gitProviderFor(rootPath) : null;
  await rememberRecentVault(rootPath);
  log("vault:scan complete", { rootPath, notes: notes.length });
  return { ok: true, rootPath, tree, notes, hasGitRepo, gitProvider };
});

ipcMain.handle("workspace:load", async (_event, rootPath = "") => {
  const store = await loadWorkspaceStore();
  const normalizedRoot = typeof rootPath === "string" && rootPath ? path.resolve(rootPath) : "";
  return {
    lastVault: store.lastVault || recentVaults[0] || null,
    workspace: normalizedRoot ? store.workspaces[normalizedRoot] || null : null
  };
});

ipcMain.handle("workspace:save", async (_event, rootPath, workspace) => {
  if (typeof rootPath !== "string" || !rootPath) return false;
  const normalizedRoot = path.resolve(rootPath);
  const store = await loadWorkspaceStore();
  store.lastVault = normalizedRoot;
  store.workspaces[normalizedRoot] = workspace && typeof workspace === "object" ? workspace : {};
  await saveWorkspaceStore(store);
  return true;
});

ipcMain.handle("window:set-vault-name", (event, vaultName) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (!window || !tektiteWindows.has(window)) return false;

  const label = typeof vaultName === "string" && vaultName.trim() ? vaultName.trim() : "";
  window.vaultName = label;
  window.setTitle(label ? `Tektite - ${label}` : "Tektite");
  buildMenu();
  return true;
});

ipcMain.handle("git:sync", async (event, rootPath) => {
  log("git:sync", rootPath);
  const send = (payload) => event.sender.send("git:sync-output", payload);
  const fail = (output) => {
    send({ type: "done", ok: false });
    return { ok: false, output };
  };

  assertInsideVault(rootPath, rootPath);
  if (!(await hasGitRepository(rootPath))) {
    send({ type: "chunk", text: "This vault does not contain a .git directory.\n" });
    return fail("This vault does not contain a .git directory.");
  }

  await checkSshAuth(rootPath, send);

  const outputs = [];
  let pull;
  try {
    pull = await runGit(rootPath, ["pull", "--ff-only"], send);
  } catch (error) {
    send({ type: "chunk", text: `${error.message}\n` });
    return fail(error.message);
  }
  const pullOutput = formatGitCommandOutput("git pull --ff-only", pull);
  outputs.push(pullOutput);
  if (pull.code !== 0) {
    return fail(pullOutput);
  }

  const status = await runGit(rootPath, ["status", "--porcelain"], send, { emptyOutput: "Working tree clean." });
  outputs.push(formatGitCommandOutput("git status --porcelain", status, status.stdout.trim() ? "" : "Working tree clean."));
  if (status.code !== 0) {
    return fail(outputs.join("\n\n"));
  }

  if (status.stdout.trim()) {
    const add = await runGit(rootPath, ["add", "-A"], send);
    outputs.push(formatGitCommandOutput("git add -A", add));
    if (add.code !== 0) {
      return fail(outputs.join("\n\n"));
    }

    const commit = await runGit(rootPath, ["commit", "-m", "Update Tektite vault"], send);
    outputs.push(formatGitCommandOutput("git commit -m \"Update Tektite vault\"", commit));
    if (commit.code !== 0) {
      return fail(outputs.join("\n\n"));
    }
  }

  const push = await runGit(rootPath, ["push"], send);
  const pushOutput = formatGitCommandOutput("git push", push);
  outputs.push(pushOutput);
  send({ type: "done", ok: push.code === 0 });
  return { ok: push.code === 0, output: outputs.join("\n\n") };
});

ipcMain.handle("note:read", async (_event, rootPath, relativePath) => {
  log("note:read", relativePath);
  const filePath = resolveVaultPath(rootPath, relativePath);
  return fs.readFile(filePath, "utf8");
});

ipcMain.handle("note:write", async (_event, rootPath, relativePath, content) => {
  log("note:write", relativePath, `${content.length} chars`);
  const filePath = resolveVaultPath(rootPath, relativePath);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, "utf8");
  const stat = await fs.stat(filePath);
  return {
    path: relativePath,
    title: noteTitle(relativePath),
    modifiedAt: stat.mtimeMs
  };
});

ipcMain.handle("note:create", async (_event, rootPath, requestedName, folder = "") => {
  log("note:create", { requestedName, folder });
  const safeName = sanitizeNoteName(requestedName || "Untitled");
  const baseFolder = normalizeRelative(folder);
  let candidate = path.posix.join(baseFolder, `${safeName}.md`);
  let index = 2;

  while (await exists(path.join(rootPath, candidate))) {
    candidate = path.posix.join(baseFolder, `${safeName} ${index}.md`);
    index += 1;
  }

  const filePath = resolveVaultPath(rootPath, candidate);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `# ${path.basename(candidate, ".md")}\n\n`, "utf8");
  return candidate;
});

ipcMain.handle("folder:create", async (_event, rootPath, requestedName, parentFolder = "") => {
  log("folder:create", { requestedName, parentFolder });
  const safeName = sanitizeEntryName(requestedName || "Untitled folder", "Untitled folder");
  const baseFolder = normalizeRelative(parentFolder);
  let candidate = path.posix.join(baseFolder, safeName);
  let index = 2;

  while (await exists(path.join(rootPath, candidate))) {
    candidate = path.posix.join(baseFolder, `${safeName} ${index}`);
    index += 1;
  }

  const folderPath = resolveVaultPath(rootPath, candidate);
  await fs.mkdir(folderPath, { recursive: false });
  return candidate;
});

ipcMain.handle("entry:delete", async (_event, rootPath, relativePath, type) => {
  log("entry:delete", { relativePath, type });
  const normalized = normalizeRelative(relativePath);
  if (!normalized) throw new Error("Cannot delete the vault root.");

  const entryPath = resolveVaultPath(rootPath, normalized);
  const stat = await fs.stat(entryPath);
  if (type === "folder" && !stat.isDirectory()) throw new Error("Selected entry is not a folder.");
  if ((type === "note" || type === "asset") && !stat.isFile()) throw new Error("Selected entry is not a file.");

  if (stat.isDirectory()) {
    await fs.rm(entryPath, { recursive: true, force: false });
  } else {
    await fs.unlink(entryPath);
  }

  return true;
});

ipcMain.handle("entry:rename", async (_event, rootPath, relativePath, type, requestedName) => {
  log("entry:rename", { relativePath, type, requestedName });
  const normalized = normalizeRelative(relativePath);
  if (!normalized) throw new Error("Cannot rename the vault root.");

  const fromPath = resolveVaultPath(rootPath, normalized);
  const stat = await fs.stat(fromPath);
  if (type === "folder" && !stat.isDirectory()) throw new Error("Selected entry is not a folder.");
  if ((type === "note" || type === "asset") && !stat.isFile()) throw new Error("Selected entry is not a file.");

  const currentName = path.basename(normalized);
  const nextName = renamedEntryName(currentName, requestedName, type);
  if (!nextName || nextName === currentName) return normalized;

  const candidate = path.posix.join(parentPosix(normalized), nextName);
  const toPath = resolveVaultPath(rootPath, candidate);
  if (await exists(toPath)) throw new Error(`"${nextName}" already exists.`);

  await fs.rename(fromPath, toPath);
  if (type === "asset" && imageExtensions.has(path.extname(candidate).toLowerCase())) {
    await updateMovedAssetReferences(rootPath, normalized, candidate);
  } else if (type === "note") {
    await updateMovedNoteReferences(rootPath, normalized, candidate);
  } else if (type === "folder") {
    await updateMovedFolderReferences(rootPath, normalized, candidate);
  }
  return candidate;
});

ipcMain.handle("entry:move", async (_event, rootPath, relativePath, type, targetFolder = "") => {
  log("entry:move", { relativePath, type, targetFolder });
  const normalized = normalizeRelative(relativePath);
  if (!normalized) throw new Error("Cannot move the vault root.");

  const fromPath = resolveVaultPath(rootPath, normalized);
  const stat = await fs.stat(fromPath);
  if (type === "folder" && !stat.isDirectory()) throw new Error("Selected entry is not a folder.");
  if ((type === "note" || type === "asset") && !stat.isFile()) throw new Error("Selected entry is not a file.");

  const destinationFolder = normalizeRelative(targetFolder);
  if (type === "folder" && destinationFolder && (destinationFolder === normalized || destinationFolder.startsWith(`${normalized}/`))) {
    throw new Error("Cannot move a folder inside itself.");
  }

  const baseName = path.basename(normalized);
  let candidate = path.posix.join(destinationFolder, baseName);
  let index = 2;
  const parsed = path.parse(baseName);

  while (await exists(path.join(rootPath, candidate))) {
    const nextName = stat.isDirectory()
      ? `${baseName} ${index}`
      : `${parsed.name} ${index}${parsed.ext}`;
    candidate = path.posix.join(destinationFolder, nextName);
    index += 1;
  }

  const toPath = resolveVaultPath(rootPath, candidate);
  await fs.mkdir(path.dirname(toPath), { recursive: true });
  await fs.rename(fromPath, toPath);
  if (type === "asset" && imageExtensions.has(path.extname(candidate).toLowerCase())) {
    await updateMovedAssetReferences(rootPath, normalized, candidate);
  } else if (type === "note") {
    await updateMovedNoteReferences(rootPath, normalized, candidate);
  } else if (type === "folder") {
    await updateMovedFolderReferences(rootPath, normalized, candidate);
  }
  return candidate;
});

ipcMain.handle("asset:import-image", async (_event, rootPath, sourcePath, targetFolder = "") => {
  log("asset:import-image", { sourcePath, targetFolder });
  const sourceStat = await fs.stat(sourcePath);
  if (!sourceStat.isFile()) throw new Error("Dropped item is not a file.");

  const extension = path.extname(sourcePath).toLowerCase();
  if (!imageExtensions.has(extension)) throw new Error("Dropped file is not a supported image.");

  const baseFolder = normalizeRelative(targetFolder);
  const sourceName = sanitizeEntryName(path.basename(sourcePath, extension), "image");
  let candidate = path.posix.join(baseFolder, `${sourceName}${extension}`);
  let index = 2;

  while (await exists(path.join(rootPath, candidate))) {
    candidate = path.posix.join(baseFolder, `${sourceName} ${index}${extension}`);
    index += 1;
  }

  const destinationPath = resolveVaultPath(rootPath, candidate);
  await fs.mkdir(path.dirname(destinationPath), { recursive: true });
  await fs.copyFile(sourcePath, destinationPath);
  return {
    path: candidate,
    name: path.basename(candidate),
    label: path.basename(candidate, path.extname(candidate))
  };
});

ipcMain.handle("asset:read-data-url", async (_event, rootPath, relativePath) => {
  log("asset:read-data-url", relativePath);
  const filePath = resolveVaultPath(rootPath, relativePath);
  const extension = path.extname(filePath).toLowerCase();
  if (!imageExtensions.has(extension)) throw new Error("Selected file is not a supported image.");

  const data = await fs.readFile(filePath);
  return `data:${imageMimeType(extension)};base64,${data.toString("base64")}`;
});

async function readDirectory(rootPath, currentPath) {
  log("readDirectory", toPosix(path.relative(rootPath, currentPath)) || ".");
  const entries = await fs.readdir(currentPath, { withFileTypes: true });
  const children = [];

  for (const entry of entries) {
    if (entry.name.startsWith(".") || entry.name === "node_modules") continue;

    const absolute = path.join(currentPath, entry.name);
    const relative = toPosix(path.relative(rootPath, absolute));

    if (entry.isDirectory()) {
      children.push(await readDirectory(rootPath, absolute));
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) {
      const stat = await fs.stat(absolute);
      children.push({
        type: "note",
        name: entry.name,
        title: noteTitle(relative),
        path: relative,
        modifiedAt: stat.mtimeMs
      });
    } else if (entry.isFile() && imageExtensions.has(path.extname(entry.name).toLowerCase())) {
      const stat = await fs.stat(absolute);
      children.push({
        type: "asset",
        kind: "image",
        name: entry.name,
        title: path.basename(entry.name, path.extname(entry.name)),
        path: relative,
        modifiedAt: stat.mtimeMs
      });
    }
  }

  children.sort((a, b) => {
    const order = { folder: 0, note: 1, asset: 2 };
    if (a.type !== b.type) return order[a.type] - order[b.type];
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });

  return {
    type: "folder",
    name: path.basename(currentPath),
    path: toPosix(path.relative(rootPath, currentPath)),
    children
  };
}

function flattenNotes(node) {
  if (node.type === "note") return [node];
  if (!Array.isArray(node.children)) return [];

  const notes = [];
  for (const child of node.children) {
    notes.push(...flattenNotes(child));
  }
  return notes;
}

async function updateMovedAssetReferences(rootPath, oldAssetPath, newAssetPath) {
  const tree = await readDirectory(rootPath, rootPath);
  const notes = flattenNotes(tree);

  for (const note of notes) {
    const notePath = resolveVaultPath(rootPath, note.path);
    const original = await fs.readFile(notePath, "utf8");
    const updated = rewriteAssetLinks(original, note.path, oldAssetPath, newAssetPath);
    if (updated !== original) {
      await fs.writeFile(notePath, updated, "utf8");
    }
  }
}

async function updateMovedNoteReferences(rootPath, oldNotePath, newNotePath) {
  const tree = await readDirectory(rootPath, rootPath);
  const notes = flattenNotes(tree);

  for (const note of notes) {
    const notePath = resolveVaultPath(rootPath, note.path);
    const original = await fs.readFile(notePath, "utf8");
    let updated = rewriteAssetLinks(original, note.path, oldNotePath, newNotePath);
    updated = rewriteWikiNoteLinks(updated, note.path, oldNotePath, newNotePath);
    if (updated !== original) {
      await fs.writeFile(notePath, updated, "utf8");
    }
  }
}

async function updateMovedFolderReferences(rootPath, oldFolderPath, newFolderPath) {
  const tree = await readDirectory(rootPath, rootPath);
  const notes = flattenNotes(tree);

  for (const note of notes) {
    const notePath = resolveVaultPath(rootPath, note.path);
    const original = await fs.readFile(notePath, "utf8");
    let updated = rewriteFolderMarkdownLinks(original, note.path, oldFolderPath, newFolderPath);
    updated = rewriteFolderWikiLinks(updated, note.path, oldFolderPath, newFolderPath);
    if (updated !== original) {
      await fs.writeFile(notePath, updated, "utf8");
    }
  }
}

function rewriteAssetLinks(markdown, notePath, oldAssetPath, newAssetPath) {
  return markdown.replace(/(!?\[[^\]]*\]\()([^)]+)(\))/g, (match, prefix, href, suffix) => {
    const decodedHref = decodeMarkdownLink(href);
    if (/^[a-z]+:\/\//i.test(decodedHref)) return match;

    const resolved = resolveMarkdownReference(notePath, decodedHref);
    if (resolved !== oldAssetPath) return match;

    const nextHref = encodeMarkdownLink(relativeMarkdownPath(notePath, newAssetPath));
    return `${prefix}${nextHref}${suffix}`;
  });
}

function rewriteFolderMarkdownLinks(markdown, notePath, oldFolderPath, newFolderPath) {
  return markdown.replace(/(!?\[[^\]]*\]\()([^)]+)(\))/g, (match, prefix, href, suffix) => {
    const decodedHref = decodeMarkdownLink(href);
    if (/^[a-z]+:\/\//i.test(decodedHref)) return match;

    const resolved = resolveMarkdownReference(notePath, decodedHref);
    const moved = movedPathInsideFolder(resolved, oldFolderPath, newFolderPath);
    if (!moved) return match;

    const nextHref = encodeMarkdownLink(relativeMarkdownPath(notePath, moved));
    return `${prefix}${nextHref}${suffix}`;
  });
}

function rewriteWikiNoteLinks(markdown, notePath, oldNotePath, newNotePath) {
  return markdown.replace(/\[\[([^\]]+)\]\]/g, (match, target) => {
    const pipeIndex = target.indexOf("|");
    const targetPart = pipeIndex >= 0 ? target.slice(0, pipeIndex) : target;
    const aliasPart = pipeIndex >= 0 ? target.slice(pipeIndex) : "";
    const headingIndex = targetPart.indexOf("#");
    const pathPart = headingIndex >= 0 ? targetPart.slice(0, headingIndex) : targetPart;
    const headingPart = headingIndex >= 0 ? targetPart.slice(headingIndex) : "";

    if (resolveWikiReference(notePath, pathPart) !== oldNotePath) return match;

    const nextTarget = wikiTargetFor(notePath, pathPart, newNotePath);
    return `[[${nextTarget}${headingPart}${aliasPart}]]`;
  });
}

function rewriteFolderWikiLinks(markdown, notePath, oldFolderPath, newFolderPath) {
  return markdown.replace(/\[\[([^\]]+)\]\]/g, (match, target) => {
    const pipeIndex = target.indexOf("|");
    const targetPart = pipeIndex >= 0 ? target.slice(0, pipeIndex) : target;
    const aliasPart = pipeIndex >= 0 ? target.slice(pipeIndex) : "";
    const headingIndex = targetPart.indexOf("#");
    const pathPart = headingIndex >= 0 ? targetPart.slice(0, headingIndex) : targetPart;
    const headingPart = headingIndex >= 0 ? targetPart.slice(headingIndex) : "";
    const resolved = resolveWikiReference(notePath, pathPart);
    const moved = movedPathInsideFolder(resolved, oldFolderPath, newFolderPath);
    if (!moved) return match;

    const nextTarget = wikiTargetFor(notePath, pathPart, moved);
    return `[[${nextTarget}${headingPart}${aliasPart}]]`;
  });
}

function movedPathInsideFolder(resolvedPath, oldFolderPath, newFolderPath) {
  if (!resolvedPath || resolvedPath === oldFolderPath) return "";
  if (!resolvedPath.startsWith(`${oldFolderPath}/`)) return "";
  return `${newFolderPath}${resolvedPath.slice(oldFolderPath.length)}`;
}

function resolveWikiReference(notePath, target) {
  const clean = decodeMarkdownLink(target).trim().replace(/^\/+/, "");
  if (!clean) return "";
  const candidates = path.extname(clean) ? [clean] : [`${clean}.md`, clean];
  for (const candidate of candidates) {
    const resolved = resolveMarkdownReference(notePath, candidate);
    if (resolved) return resolved;
  }
  return "";
}

function wikiTargetFor(notePath, oldTarget, newNotePath) {
  const relative = relativeMarkdownPath(notePath, newNotePath).replace(/\.md$/i, "");
  if (oldTarget.includes("/") || oldTarget.startsWith(".") || oldTarget.startsWith("/")) {
    return relative.replace(/^\.\//, "");
  }
  return path.basename(newNotePath, path.extname(newNotePath));
}

function resolveMarkdownReference(notePath, href) {
  const clean = href.trim().replace(/^<|>$/g, "").replace(/#.*$/, "");
  const noteFolder = parentPosix(notePath);
  const joined = clean.startsWith("/")
    ? clean.replace(/^\/+/, "")
    : path.posix.join(noteFolder, clean);
  return normalizePosix(joined);
}

function relativeMarkdownPath(notePath, assetPath) {
  const noteFolder = parentPosix(notePath);
  const relative = path.posix.relative(noteFolder || ".", assetPath);
  return relative.startsWith(".") ? relative : `./${relative}`;
}

function decodeMarkdownLink(value) {
  const trimmed = value.trim().replace(/^<|>$/g, "");
  try {
    return decodeURIComponent(trimmed);
  } catch {
    return trimmed;
  }
}

function encodeMarkdownLink(value) {
  return encodeURI(value).replaceAll("%5B", "[").replaceAll("%5D", "]");
}

function parentPosix(value) {
  const parts = value.split("/");
  parts.pop();
  return parts.join("/");
}

function resolveVaultPath(rootPath, relativePath) {
  const normalizedRoot = path.resolve(rootPath);
  const resolved = path.resolve(normalizedRoot, relativePath);
  assertInsideVault(normalizedRoot, resolved);
  return resolved;
}

function assertInsideVault(rootPath, candidatePath) {
  const normalizedRoot = path.resolve(rootPath);
  const normalizedCandidate = path.resolve(candidatePath);
  const relative = path.relative(normalizedRoot, normalizedCandidate);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Requested path is outside the vault.");
  }
}

function noteTitle(relativePath) {
  return path.basename(relativePath, path.extname(relativePath));
}

function sanitizeNoteName(value) {
  return sanitizeEntryName(value, "Untitled").replace(/\.md$/i, "") || "Untitled";
}

function renamedEntryName(currentName, requestedName, type) {
  if (type === "folder") return sanitizeEntryName(requestedName || currentName, currentName);

  const currentExtension = path.extname(currentName);
  const fallback = path.basename(currentName, currentExtension);
  const requested = sanitizeEntryName(requestedName || fallback, fallback);
  const requestedExtension = path.extname(requested);

  if (type === "note") {
    return `${requested.replace(/\.md$/i, "") || fallback}.md`;
  }

  if (requestedExtension && imageExtensions.has(requestedExtension.toLowerCase())) {
    return requested;
  }

  return `${requested.replace(/\.[^.]+$/, "") || fallback}${currentExtension}`;
}

function imageMimeType(extension) {
  switch (extension) {
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".gif":
      return "image/gif";
    case ".webp":
      return "image/webp";
    case ".svg":
      return "image/svg+xml";
    case ".avif":
      return "image/avif";
    default:
      return "image/png";
  }
}

function sanitizeEntryName(value, fallback) {
  return value
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, " ")
    .replace(/\s+/g, " ")
    .slice(0, 80)
    .trim() || fallback;
}

function normalizeRelative(value) {
  return normalizePosix(toPosix(value || "").replace(/^\/+/, ""));
}

function normalizePosix(value) {
  const parts = [];
  for (const part of value.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") {
      parts.pop();
      continue;
    }
    parts.push(part);
  }
  return parts.join("/");
}

function toPosix(value) {
  return value.split(path.sep).join("/");
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function hasGitRepository(rootPath) {
  try {
    assertInsideVault(rootPath, path.join(rootPath, ".git"));
    await fs.access(path.join(rootPath, ".git"));
    return true;
  } catch {
    return false;
  }
}

async function gitProviderFor(rootPath) {
  try {
    const configPath = path.join(rootPath, ".git", "config");
    assertInsideVault(rootPath, configPath);
    const config = await fs.readFile(configPath, "utf8");
    return /\bgithub\.com[:/]/i.test(config) || /\bgithub\.com\b/i.test(config) ? "github" : "git";
  } catch {
    return "git";
  }
}

function gitFailureReason({ timedOut, signal, exitCode }) {
  if (timedOut) return "timeout";
  return signal || exitCode;
}

async function checkSshAuth(rootPath, send) {
  const remoteResult = await runGit(rootPath, ["remote", "get-url", "origin"]);
  if (remoteResult.code !== 0) return;

  const remoteUrl = remoteResult.stdout.trim();
  if (!remoteUrl || remoteUrl.startsWith("http://") || remoteUrl.startsWith("https://")) return;

  // SSH URL: git@github.com:user/repo.git or ssh://git@github.com/user/repo.git
  const hostMatch = remoteUrl.match(/[@/]([a-zA-Z0-9._-]+)[:/]/);
  if (!hostMatch) return;
  const host = hostMatch[1];

  const { execFile } = require("node:child_process");
  await new Promise((resolve) => {
    execFile(
      "ssh",
      ["-T", `git@${host}`, "-o", "BatchMode=yes", "-o", "ConnectTimeout=10", "-o", "StrictHostKeyChecking=accept-new"],
      { env: { PATH: gitSafePath, SSH_AUTH_SOCK: process.env.SSH_AUTH_SOCK || "" } },
      (error, _stdout, stderr) => {
        // exit code 1 with "successfully authenticated" is normal for GitHub/GitLab
        const output = (stderr || "").toLowerCase();
        const authenticated = !error || output.includes("successfully authenticated") || output.includes("welcome to");
        if (!authenticated) {
          send({
            type: "chunk",
            text: `Warning: SSH authentication to ${host} failed. Git sync will likely fail.\n${stderr ? stderr.trim() + "\n" : ""}`
          });
        }
        resolve();
      }
    );
  });
}

async function runGit(rootPath, args, send = () => {}, options = {}) {
  const gitExecutable = await resolveGitExecutable();
  return new Promise((resolve) => {
    const command = `git ${args.map((arg) => (/\s/.test(arg) ? JSON.stringify(arg) : arg)).join(" ")}`;
    send({ type: "command", text: `$ ${command}\n` });

    const child = spawn(gitExecutable, args, {
      cwd: rootPath,
      env: gitEnvironment()
    });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, 120000);

    child.stdout.on("data", (data) => {
      const text = data.toString();
      stdout += text;
      send({ type: "chunk", text });
    });
    child.stderr.on("data", (data) => {
      const text = data.toString();
      stderr += text;
      send({ type: "chunk", text });
    });
    child.on("error", (error) => {
      clearTimeout(timeout);
      const message = `${error.message}\n`;
      send({ type: "chunk", text: message });
      resolve({
        code: 1,
        signal: null,
        stdout,
        stderr,
        error: error.message
      });
    });
    child.on("close", (code, signal) => {
      clearTimeout(timeout);
      const exitCode = timedOut ? 1 : code || 0;
      const failureReason = gitFailureReason({ timedOut, signal, exitCode });
      const status = exitCode === 0 ? "OK" : `FAILED (${failureReason})`;
      if (!stdout.trim() && options.emptyOutput) send({ type: "chunk", text: `${options.emptyOutput}\n` });
      send({ type: "status", text: `${status}\n\n` });
      resolve({
        code: exitCode,
        signal: timedOut ? "timeout" : signal,
        stdout,
        stderr,
        error: timedOut ? "Command timed out." : ""
      });
    });
  });
}

async function resolveGitExecutable() {
  for (const candidate of gitExecutableCandidates) {
    if (await isSafeExecutable(candidate)) return candidate;
  }
  throw new Error("Git executable was not found in a trusted system location.");
}

async function isSafeExecutable(candidate) {
  try {
    const stat = await fs.stat(candidate);
    if (!stat.isFile()) return false;
    await fs.access(candidate, fs.constants.X_OK);

    const parent = await fs.stat(path.dirname(candidate));
    return (parent.mode & 0o002) === 0;
  } catch {
    return false;
  }
}

function gitEnvironment() {
  return {
    HOME: process.env.HOME || "",
    LANG: process.env.LANG || "en_US.UTF-8",
    LC_ALL: process.env.LC_ALL || "",
    SSH_AUTH_SOCK: process.env.SSH_AUTH_SOCK || "",
    GIT_TERMINAL_PROMPT: "0",
    PATH: gitSafePath
  };
}

function formatGitCommandOutput(command, result, emptyOutput = "") {
  const status = result.code === 0 ? "OK" : `FAILED (${result.signal || result.code})`;
  const parts = [`$ ${command}`, status];
  if (result.stdout.trim()) parts.push("", result.stdout.trim());
  else if (emptyOutput) parts.push("", emptyOutput);
  if (result.stderr.trim()) parts.push("", result.stderr.trim());
  if (result.error && result.code !== 0 && !result.stderr.trim()) parts.push("", result.error);
  return parts.join("\n");
}
