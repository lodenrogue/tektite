const { app, BrowserWindow, dialog, ipcMain, Menu, nativeImage } = require("electron");
const fs = require("fs/promises");
const path = require("path");

let mainWindow;
let aboutWindow;
let splashWindow;
let splashShownAt = 0;
const verbose = process.env.TEKTITE_VERBOSE === "1" || process.env.DEBUG?.includes("tektite");
const appIconPath = path.join(__dirname, "..", "tektive-icon.webp");
const fallbackAppIconPath = path.join(__dirname, "..", "assets", "icons", "tektite-icon.png");
const imageExtensions = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".avif"]);
const splashMinimumMs = 1200;

app.name = "Tektite";
app.setName("Tektite");

function log(...args) {
  if (verbose) console.log("[tektite:main]", ...args);
}

function createWindow(options = {}) {
  const shouldShowImmediately = options.show !== false;
  const appIcon = loadAppIcon();
  mainWindow = new BrowserWindow({
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

  mainWindow.loadFile(path.join(__dirname, "renderer", "index.html"));
  mainWindow.once("ready-to-show", () => {
    if (splashWindow && !splashWindow.isDestroyed()) {
      const elapsed = Date.now() - splashShownAt;
      setTimeout(() => {
        if (splashWindow && !splashWindow.isDestroyed()) splashWindow.close();
        splashWindow = null;
        if (mainWindow && !mainWindow.isDestroyed()) mainWindow.show();
      }, Math.max(0, splashMinimumMs - elapsed));
    } else if (!shouldShowImmediately && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  if (process.platform === "darwin" && app.dock) {
    app.dock.setIcon(appIcon);
  }
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

  splashWindow.loadFile(path.join(__dirname, "splash.html"));
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
    parent: mainWindow || undefined,
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

function loadAppIcon() {
  const icon = nativeImage.createFromPath(appIconPath);
  if (!icon.isEmpty()) return icon;
  return nativeImage.createFromPath(fallbackAppIconPath);
}

function buildMenu() {
  const isMac = process.platform === "darwin";
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
          label: "Open Vault...",
          accelerator: "CmdOrCtrl+O",
          click: () => mainWindow?.webContents.send("menu:open-vault")
        },
        {
          label: "New Node",
          accelerator: "CmdOrCtrl+N",
          click: () => mainWindow?.webContents.send("menu:new-note")
        },
        { type: "separator" },
        isMac ? { role: "close" } : { role: "quit" }
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
        { role: "reload" },
        { role: "toggleDevTools" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" }
      ]
    },
    ...(!isMac
      ? [
          {
            label: "Help",
            submenu: [{ label: "About Tektite", click: showAboutWindow }]
          }
        ]
      : [])
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.whenReady().then(() => {
  app.setName("Tektite");
  buildMenu();
  createSplashWindow();
  createWindow({ show: false });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

ipcMain.handle("vault:choose", async () => {
  log("vault:choose start");
  const result = await dialog.showOpenDialog(mainWindow, {
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
  const tree = await readDirectory(rootPath, rootPath);
  const notes = flattenNotes(tree);
  log("vault:scan complete", { rootPath, notes: notes.length });
  return { rootPath, tree, notes };
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
  return encodeURI(value).replace(/%5B/g, "[").replace(/%5D/g, "]");
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
