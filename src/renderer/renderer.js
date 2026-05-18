const state = {
  rootPath: null,
  tree: null,
  notes: [],
  noteByPath: new Map(),
  noteByTitle: new Map(),
  noteContent: new Map(),
  activePath: null,
  activeContent: "",
  selectedPath: "",
  selectedType: "folder",
  showFileExtensions: false,
  saveTimer: null,
  graph: null,
  collapsedFolders: new Set(),
  nameDialogResolve: null,
  layout: {
    sidebarWidth: 300,
    editorRatio: 0.52,
    sidebarGraphRatio: 0.34
  },
  activeResize: null,
  graphViewport: {
    scale: 1,
    x: 0,
    y: 0
  },
  graphPositions: new Map(),
  graphDrag: null,
  previewHistory: [],
  previewForwardHistory: [],
  mention: {
    active: false,
    start: -1,
    query: "",
    selectedIndex: 0,
    items: []
  },
  editorHistory: {
    path: null,
    stack: [],
    index: -1,
    restoring: false
  }
};

const verbose = new URLSearchParams(window.location.search).has("debug") ||
  localStorage.getItem("tektite:verbose") === "1";

function log(...args) {
  if (verbose) console.log("[tektite:renderer]", ...args);
}

const els = {
  vaultName: document.getElementById("vaultName"),
  openVaultButton: document.getElementById("openVaultButton"),
  refreshButton: document.getElementById("refreshButton"),
  themeButton: document.getElementById("themeButton"),
  themeIcon: document.getElementById("themeIcon"),
  suffixButton: document.getElementById("suffixButton"),
  suffixIcon: document.getElementById("suffixIcon"),
  searchInput: document.getElementById("searchInput"),
  fileTree: document.getElementById("fileTree"),
  noteTitle: document.getElementById("noteTitle"),
  notePath: document.getElementById("notePath"),
  saveState: document.getElementById("saveState"),
  editor: document.getElementById("editor"),
  mentionMenu: document.getElementById("mentionMenu"),
  preview: document.getElementById("preview"),
  previewBackButton: document.getElementById("previewBackButton"),
  previewForwardButton: document.getElementById("previewForwardButton"),
  graph: document.getElementById("graph"),
  graphSvg: document.getElementById("graphSvg"),
  graphEmpty: document.getElementById("graphEmpty"),
  sidebar: document.querySelector(".sidebar"),
  appShell: document.querySelector(".app-shell"),
  workspace: document.querySelector(".workspace"),
  sidebarResizer: document.getElementById("sidebarResizer"),
  workspaceResizer: document.getElementById("workspaceResizer"),
  sidebarGraphResizer: document.getElementById("sidebarGraphResizer"),
  treeContextMenu: document.getElementById("treeContextMenu"),
  nameDialog: document.getElementById("nameDialog"),
  nameForm: document.getElementById("nameForm"),
  nameDialogTitle: document.getElementById("nameDialogTitle"),
  nameInput: document.getElementById("nameInput"),
  confirmNameButton: document.getElementById("confirmNameButton"),
  cancelNameButton: document.getElementById("cancelNameButton"),
  cancelNameXButton: document.getElementById("cancelNameXButton")
};

boot();

function boot() {
  loadLayout();
  applyLayout();
  state.showFileExtensions = localStorage.getItem("tektite:showFileExtensions") === "1";
  updateSuffixButton();
  els.openVaultButton.addEventListener("click", chooseVault);
  els.refreshButton.addEventListener("click", refreshVault);
  els.themeButton.addEventListener("click", toggleTheme);
  els.suffixButton.addEventListener("click", toggleFileExtensions);
  els.searchInput.addEventListener("input", renderTree);
  els.editor.addEventListener("input", onEditorInput);
  els.editor.addEventListener("keydown", onEditorKeydown);
  els.editor.addEventListener("click", updateMentionMenu);
  els.editor.addEventListener("scroll", positionMentionMenu);
  els.editor.addEventListener("dragover", onEditorDragOver);
  els.editor.addEventListener("drop", onEditorDrop);
  els.fileTree.addEventListener("dragstart", onTreeDragStart);
  els.fileTree.addEventListener("dragover", onTreeDragOver);
  els.fileTree.addEventListener("drop", onTreeDrop);
  els.fileTree.addEventListener("contextmenu", onTreeContextMenu);
  els.fileTree.addEventListener("click", closeTreeContextMenu);
  els.preview.addEventListener("click", onPreviewClick);
  els.previewBackButton.addEventListener("click", goBackPreviewHistory);
  els.previewForwardButton.addEventListener("click", goForwardPreviewHistory);
  els.graphSvg.addEventListener("click", onGraphClick);
  els.graphSvg.addEventListener("wheel", onGraphWheel, { passive: false });
  els.graphSvg.addEventListener("pointerdown", onGraphPointerDown);
  els.sidebarResizer.addEventListener("pointerdown", (event) => startResize(event, "sidebar"));
  els.workspaceResizer.addEventListener("pointerdown", (event) => startResize(event, "editor"));
  els.sidebarGraphResizer.addEventListener("pointerdown", (event) => startResize(event, "sidebarGraph"));
  els.nameForm.addEventListener("submit", onNameSubmit);
  els.cancelNameButton.addEventListener("click", () => closeNameDialog(null));
  els.cancelNameXButton.addEventListener("click", () => closeNameDialog(null));
  els.nameDialog.addEventListener("click", (event) => {
    if (event.target === els.nameDialog) closeNameDialog(null);
  });
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeTreeContextMenu();
    if (event.key === "Escape" && !els.nameDialog.classList.contains("hidden")) {
      closeNameDialog(null);
    }
  });
  window.addEventListener("click", (event) => {
    if (!event.target.closest?.("#treeContextMenu")) closeTreeContextMenu();
  });
  window.addEventListener("resize", () => {
    applyLayout();
    updateGraph();
  });

  window.tektite.onOpenVault(chooseVault);
  window.tektite.onOpenRecentVault(openVault);
  window.tektite.onNewNote(createNote);

  const lastVault = localStorage.getItem("tektite:lastVault");
  applyTheme(localStorage.getItem("tektite:theme") || "dark");
  if (lastVault) openVault(lastVault).catch(() => {
    localStorage.removeItem("tektite:lastVault");
    showEmptyState();
  });
}

function loadLayout() {
  try {
    const saved = JSON.parse(localStorage.getItem("tektite:layout") || "{}");
    state.layout.sidebarWidth = clamp(Number(saved.sidebarWidth) || 300, 220, 520);
    state.layout.editorRatio = clamp(Number(saved.editorRatio) || 0.52, 0.28, 0.78);
    state.layout.sidebarGraphRatio = clamp(Number(saved.sidebarGraphRatio) || 0.34, 0.2, 0.7);
  } catch {
    state.layout.sidebarWidth = 300;
    state.layout.editorRatio = 0.52;
    state.layout.sidebarGraphRatio = 0.34;
  }
}

function saveLayout() {
  localStorage.setItem("tektite:layout", JSON.stringify(state.layout));
}

function applyLayout() {
  const windowWidth = window.innerWidth || 1200;
  const maxSidebar = Math.max(220, Math.min(620, windowWidth - 720));
  state.layout.sidebarWidth = clamp(state.layout.sidebarWidth, 220, maxSidebar);
  state.layout.editorRatio = clamp(state.layout.editorRatio, 0.28, 0.78);
  state.layout.sidebarGraphRatio = clamp(state.layout.sidebarGraphRatio, 0.2, 0.7);

  els.appShell.style.gridTemplateColumns = `${state.layout.sidebarWidth}px 6px minmax(0, 1fr)`;
  const workspaceWidth = Math.max(0, windowWidth - state.layout.sidebarWidth - 6);
  const editorWidth = Math.round(Math.max(1, workspaceWidth - 6) * state.layout.editorRatio);
  els.workspace.style.gridTemplateColumns = `minmax(260px, ${editorWidth}px) 6px minmax(260px, 1fr)`;
  els.sidebar.style.setProperty("--sidebar-graph-ratio", state.layout.sidebarGraphRatio);
}

function startResize(event, target) {
  event.preventDefault();
  const workspaceRect = els.workspace.getBoundingClientRect();
  state.activeResize = {
    target,
    pointerId: event.pointerId,
    startX: event.clientX,
    startSidebarWidth: state.layout.sidebarWidth,
    startEditorRatio: state.layout.editorRatio,
    startSidebarGraphRatio: state.layout.sidebarGraphRatio,
    workspaceLeft: workspaceRect.left,
    workspaceWidth: workspaceRect.width,
    sidebarTop: els.sidebar.getBoundingClientRect().top,
    sidebarHeight: els.sidebar.getBoundingClientRect().height
  };

  event.currentTarget.setPointerCapture(event.pointerId);
  document.body.classList.add(target === "sidebarGraph" ? "resizing-y" : "resizing");
  window.addEventListener("pointermove", onResizeMove);
  window.addEventListener("pointerup", stopResize, { once: true });
  window.addEventListener("pointercancel", stopResize, { once: true });
}

function onResizeMove(event) {
  if (!state.activeResize) return;
  const resize = state.activeResize;

  if (resize.target === "sidebar") {
    const nextWidth = resize.startSidebarWidth + event.clientX - resize.startX;
    const maxSidebar = Math.max(220, Math.min(620, window.innerWidth - 720));
    state.layout.sidebarWidth = clamp(nextWidth, 220, maxSidebar);
  } else if (resize.target === "editor") {
    const x = event.clientX - resize.workspaceLeft;
    const availableWidth = Math.max(1, resize.workspaceWidth - 6);
    state.layout.editorRatio = clamp(x / availableWidth, 0.28, 0.78);
  } else {
    const y = event.clientY - resize.sidebarTop;
    state.layout.sidebarGraphRatio = clamp(1 - y / Math.max(1, resize.sidebarHeight), 0.2, 0.7);
  }

  applyLayout();
  updateGraph();
}

function stopResize() {
  if (!state.activeResize) return;
  state.activeResize = null;
  document.body.classList.remove("resizing");
  document.body.classList.remove("resizing-y");
  window.removeEventListener("pointermove", onResizeMove);
  window.removeEventListener("pointercancel", stopResize);
  saveLayout();
}

function toggleTheme() {
  const current = document.documentElement.dataset.theme || "dark";
  applyTheme(current === "dark" ? "light" : "dark");
}

function applyTheme(theme) {
  const nextTheme = theme === "light" ? "light" : "dark";
  document.documentElement.dataset.theme = nextTheme;
  localStorage.setItem("tektite:theme", nextTheme);
  els.themeIcon.textContent = nextTheme === "dark" ? "☀" : "☾";
  const label = nextTheme === "dark" ? "Light Mode" : "Dark Mode";
  els.themeButton.dataset.tooltip = label;
  els.themeButton.setAttribute("aria-label", label);
  updateGraph();
}

function toggleFileExtensions() {
  state.showFileExtensions = !state.showFileExtensions;
  localStorage.setItem("tektite:showFileExtensions", state.showFileExtensions ? "1" : "0");
  updateSuffixButton();
  renderTree();
}

function updateSuffixButton() {
  els.suffixIcon.textContent = state.showFileExtensions ? "abc" : ".md";
  const label = state.showFileExtensions ? "Hide File Suffixes" : "Show File Suffixes";
  els.suffixButton.dataset.tooltip = label;
  els.suffixButton.setAttribute("aria-label", label);
}

async function chooseVault() {
  log("chooseVault start");
  const rootPath = await window.tektite.chooseVault();
  if (!rootPath) return;
  await openVault(rootPath);
}

async function openVault(rootPath) {
  log("openVault start", rootPath);
  setSaveState("Opening...");
  try {
    const vault = await window.tektite.scanVault(rootPath);
    log("openVault scan complete", { notes: vault.notes.length });
    state.rootPath = vault.rootPath;
    state.tree = vault.tree;
    state.notes = vault.notes;
    state.selectedPath = "";
    state.selectedType = "folder";
    state.previewHistory = [];
    state.previewForwardHistory = [];
    loadCollapsedFolders();
    indexNotes();
    await loadGraphContent();

    localStorage.setItem("tektite:lastVault", rootPath);
    els.vaultName.textContent = rootPath.split(/[\\/]/).pop() || rootPath;
    renderTree();
    updateGraph();

    if (state.notes.length > 0) {
      await openNote(state.notes[0].path);
    } else {
      showEmptyState("Create a note to start writing.");
    }
    setSaveState("Idle");
    log("openVault complete");
  } catch (error) {
    console.error("[tektite:renderer] openVault failed", error);
    showEmptyState(error.message || "Could not open vault.");
    setSaveState("Failed");
  }
}

async function refreshVault() {
  log("refreshVault start");
  if (!state.rootPath) return chooseVault();
  const activePath = state.activePath;
  const selectedPath = state.selectedPath;
  const selectedType = state.selectedType;
  const vault = await window.tektite.scanVault(state.rootPath);
  state.tree = vault.tree;
  state.notes = vault.notes;
  indexNotes();
  await loadGraphContent();
  if (selectedPath && entryExists(selectedPath, selectedType)) {
    state.selectedPath = selectedPath;
    state.selectedType = selectedType;
  } else if (activePath && state.noteByPath.has(activePath)) {
    state.selectedPath = activePath;
    state.selectedType = "note";
  } else {
    state.selectedPath = "";
    state.selectedType = "folder";
  }
  renderTree();
  updateGraph();
  if (activePath && state.noteByPath.has(activePath)) await openNote(activePath, { preserveCursor: true });
}

async function createNote(context = currentSelection()) {
  log("createNote start");
  if (!state.rootPath) {
    await chooseVault();
    if (!state.rootPath) return;
  }

  const requestedName = await openNameDialog({ title: "New node", defaultName: "Untitled" });
  if (requestedName === null) {
    log("createNote canceled");
    return;
  }

  const folder = folderForContext(context);
  try {
    const newPath = await window.tektite.createNote(state.rootPath, requestedName, folder);
    await refreshVault();
    await openNote(newPath);
    log("createNote complete", newPath);
  } catch (error) {
    console.error("[tektite:renderer] createNote failed", error);
    setSaveState("Failed");
  }
}

async function createFolder(context = currentSelection()) {
  log("createFolder start");
  if (!state.rootPath) {
    await chooseVault();
    if (!state.rootPath) return;
  }

  const requestedName = await openNameDialog({ title: "New folder", defaultName: "Untitled folder" });
  if (requestedName === null) {
    log("createFolder canceled");
    return;
  }

  try {
    const newPath = await window.tektite.createFolder(state.rootPath, requestedName, folderForContext(context));
    state.collapsedFolders.delete(parentFolder(newPath));
    await refreshVault();
    selectEntry(newPath, "folder");
    log("createFolder complete", newPath);
  } catch (error) {
    console.error("[tektite:renderer] createFolder failed", error);
    setSaveState("Failed");
  }
}

async function deleteSelectedEntry(context = currentSelection()) {
  if (!state.rootPath) return;
  const selection = context?.path ? context : currentSelection();
  if (!selection.path) return;

  const label = selection.type === "folder" ? selection.path : selection.path.split("/").pop();
  const message = selection.type === "folder"
    ? `Delete folder "${label}" and everything inside it?`
    : `Delete file "${label}"?`;
  if (!window.confirm(message)) return;

  try {
    clearTimeout(state.saveTimer);
    await window.tektite.deleteEntry(state.rootPath, selection.path, selection.type);
    if (selection.path === state.activePath || isPathInside(state.activePath, selection.path)) {
      showEmptyState("Select or create a note.");
    }
    state.selectedPath = "";
    state.selectedType = "folder";
    await refreshVault();
    setSaveState("Deleted");
  } catch (error) {
    console.error("[tektite:renderer] deleteSelectedEntry failed", error);
    setSaveState("Failed");
  }
}

function openNameDialog({ title, defaultName }) {
  return new Promise((resolve) => {
    state.nameDialogResolve = resolve;
    els.nameDialogTitle.textContent = title;
    els.confirmNameButton.textContent = "Create";
    els.nameInput.value = defaultName;
    els.nameDialog.classList.remove("hidden");
    requestAnimationFrame(() => {
      els.nameInput.focus();
      els.nameInput.select();
    });
  });
}

function onNameSubmit(event) {
  event.preventDefault();
  const name = els.nameInput.value.trim();
  closeNameDialog(name || "Untitled");
}

function closeNameDialog(value) {
  if (!state.nameDialogResolve) return;
  els.nameDialog.classList.add("hidden");
  const resolve = state.nameDialogResolve;
  state.nameDialogResolve = null;
  resolve(value);
}

function updateMentionMenu() {
  if (!state.activePath || document.activeElement !== els.editor) {
    closeMentionMenu();
    return;
  }

  const cursor = els.editor.selectionStart;
  const beforeCursor = els.editor.value.slice(0, cursor);
  const lineStart = Math.max(beforeCursor.lastIndexOf("\n") + 1, 0);
  const linePrefix = beforeCursor.slice(lineStart);
  const match = linePrefix.match(/(^|[\s([{@])@([A-Za-z0-9._\- /]*)$/);

  if (!match) {
    closeMentionMenu();
    return;
  }

  const query = match[2].toLowerCase();
  const start = cursor - match[2].length - 1;
  const items = state.notes
    .filter((note) => note.name.toLowerCase().includes(query) || note.path.toLowerCase().includes(query))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }))
    .slice(0, 12);

  if (!items.length) {
    closeMentionMenu();
    return;
  }

  state.mention = {
    active: true,
    start,
    query,
    selectedIndex: state.mention.query === query ? Math.min(state.mention.selectedIndex, items.length - 1) : 0,
    items
  };
  renderMentionMenu();
  positionMentionMenu();
}

function renderMentionMenu() {
  if (!state.mention.active) return;
  els.mentionMenu.innerHTML = "";
  state.mention.items.forEach((note, index) => {
    const option = document.createElement("button");
    option.type = "button";
    option.className = `mention-option${index === state.mention.selectedIndex ? " active" : ""}`;
    option.setAttribute("role", "option");
    option.setAttribute("aria-selected", String(index === state.mention.selectedIndex));
    option.innerHTML = `<span>${escapeHtml(note.name)}</span><small>${escapeHtml(note.path)}</small>`;
    option.addEventListener("mousedown", (event) => {
      event.preventDefault();
      insertMentionLink(note);
    });
    els.mentionMenu.appendChild(option);
  });
  els.mentionMenu.classList.remove("hidden");
}

function positionMentionMenu() {
  if (!state.mention.active) return;
  const editorRect = els.editor.getBoundingClientRect();
  const caret = getTextareaCaretPosition(els.editor, els.editor.selectionStart);
  els.mentionMenu.style.left = `${caret.left}px`;
  els.mentionMenu.style.top = `${Math.min(caret.top + caret.height + 4, editorRect.bottom - 8)}px`;
}

function closeMentionMenu() {
  state.mention.active = false;
  state.mention.items = [];
  els.mentionMenu.classList.add("hidden");
  els.mentionMenu.innerHTML = "";
}

function insertMentionLink(note) {
  if (!note) return;
  const cursor = els.editor.selectionStart;
  const link = `[${note.name}](${relativeMarkdownLink(state.activePath, note.path)})`;
  els.editor.setRangeText(link, state.mention.start, cursor, "end");
  state.activeContent = els.editor.value;
  closeMentionMenu();
  renderPreview(state.activeContent);
  updateGraph();
  recordEditorHistory();
  setSaveState("Unsaved");
  clearTimeout(state.saveTimer);
  state.saveTimer = setTimeout(saveActiveNote, 150);
  els.editor.focus();
}

function onEditorDragOver(event) {
  if (!state.rootPath || !state.activePath) return;
  const hasInternalEntry = event.dataTransfer.types.includes("application/x-tektite-entry");
  if (!hasInternalEntry && !hasImageFiles(event.dataTransfer.files)) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = "copy";
}

async function onEditorDrop(event) {
  if (!state.rootPath || !state.activePath) return;
  const movePayload = parseMovePayload(event.dataTransfer);
  if (movePayload) {
    event.preventDefault();
    insertDroppedEntryLink(movePayload, event);
    return;
  }

  if (!hasImageFiles(event.dataTransfer.files)) return;
  event.preventDefault();
  const images = droppedImageFiles(event.dataTransfer.files);
  if (!images.length) return;

  try {
    const imported = [];
    for (const file of images) {
      const sourcePath = window.tektite.getFilePath(file);
      if (!sourcePath) continue;
      imported.push(await window.tektite.importImage(state.rootPath, sourcePath, activeFolder()));
    }
    if (!imported.length) return;

    const markdown = imported
      .map((image) => `![${image.label}](${relativeMarkdownLink(state.activePath, image.path)})`)
      .join("\n");
    const insertion = markdown.endsWith("\n") ? markdown : `${markdown}\n`;
    insertEditorMarkdown(insertion, event);
    await saveActiveNote();
  } catch (error) {
    console.error("[tektite:renderer] image drop into editor failed", error);
    setSaveState("Failed");
  }
}

function insertDroppedEntryLink(payload, event) {
  if (!payload?.path) return;
  const markdown = markdownForEntry(payload);
  if (!markdown) return;
  insertEditorMarkdown(markdown, event);
}

function markdownForEntry(entry) {
  const label = entry.path.split("/").pop() || entry.path;
  const link = relativeMarkdownLink(state.activePath, entry.path);
  if (entry.type === "asset" && isImagePath(entry.path)) {
    return `![${basenameWithoutExtension(label)}](${link})`;
  }
  return `[${label}](${link})`;
}

function insertEditorMarkdown(markdown, event) {
  const position = getTextareaPositionFromPoint(els.editor, event.clientX, event.clientY);
  els.editor.focus();
  els.editor.setSelectionRange(position, position);

  const insertion = markdown.endsWith("\n") ? markdown : `${markdown}\n`;
  els.editor.setRangeText(insertion, els.editor.selectionStart, els.editor.selectionEnd, "end");
  state.activeContent = els.editor.value;
  renderPreview(state.activeContent);
  updateGraph();
  recordEditorHistory();
  setSaveState("Unsaved");
  clearTimeout(state.saveTimer);
  state.saveTimer = setTimeout(saveActiveNote, 150);
}

function onTreeDragOver(event) {
  if (!state.rootPath) return;
  const hasInternalMove = event.dataTransfer.types.includes("application/x-tektite-entry");
  if (!hasInternalMove && !hasImageFiles(event.dataTransfer.files)) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = hasInternalMove ? "move" : "copy";
}

async function onTreeDrop(event) {
  if (!state.rootPath) return;
  const movePayload = parseMovePayload(event.dataTransfer);
  if (movePayload) {
    await moveTreeEntry(movePayload, folderFromDropTarget(event.target));
    return;
  }

  if (!hasImageFiles(event.dataTransfer.files)) return;
  event.preventDefault();
  const targetFolderPath = folderFromDropTarget(event.target);
  const images = droppedImageFiles(event.dataTransfer.files);

  try {
    for (const file of images) {
      const sourcePath = window.tektite.getFilePath(file);
      if (!sourcePath) continue;
      await window.tektite.importImage(state.rootPath, sourcePath, targetFolderPath);
    }
    state.collapsedFolders.delete(targetFolderPath);
    await refreshVault();
    setSaveState("Imported");
  } catch (error) {
    console.error("[tektite:renderer] image drop into tree failed", error);
    setSaveState("Failed");
  }
}

function onTreeDragStart(event) {
  const row = event.target.closest?.("[data-path][data-type]");
  if (!row) return;
  const path = row.dataset.path || "";
  const type = row.dataset.type;
  if (!path || !["folder", "note", "asset"].includes(type)) return;
  event.dataTransfer.effectAllowed = "copyMove";
  event.dataTransfer.setData("application/x-tektite-entry", JSON.stringify({ path, type }));
  event.dataTransfer.setData("text/plain", path);
}

async function moveTreeEntry(payload, targetFolderPath) {
  try {
    if (!payload.path || payload.path === targetFolderPath) return;
    if (payload.type === "folder" && targetFolderPath.startsWith(`${payload.path}/`)) return;
    const originalActivePath = state.activePath;
    const nextPath = await window.tektite.moveEntry(state.rootPath, payload.path, payload.type, targetFolderPath);
    if (payload.path === originalActivePath) {
      state.activePath = nextPath;
    } else if (payload.type === "folder" && isPathInside(originalActivePath, payload.path)) {
      state.activePath = `${nextPath}${originalActivePath.slice(payload.path.length)}`;
    }
    if (state.selectedPath === payload.path) {
      state.selectedPath = nextPath;
      state.selectedType = payload.type;
    }
    state.collapsedFolders.delete(targetFolderPath);
    await refreshVault();
    if (state.activePath && state.noteByPath.has(state.activePath)) await openNote(state.activePath);
    else if (payload.type === "note") await openNote(nextPath);
    else selectEntry(nextPath, payload.type);
    setSaveState("Moved");
  } catch (error) {
    console.error("[tektite:renderer] moveTreeEntry failed", error);
    setSaveState("Failed");
  }
}

function parseMovePayload(dataTransfer) {
  try {
    const raw = dataTransfer.getData("application/x-tektite-entry");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function folderFromDropTarget(target) {
  const row = target.closest?.("[data-path][data-type]");
  if (!row) return targetFolder();
  const type = row.dataset.type;
  const path = row.dataset.path || "";
  return type === "folder" ? path : parentFolder(path);
}

function hasImageFiles(files) {
  return droppedImageFiles(files).length > 0;
}

function droppedImageFiles(files) {
  return [...files].filter((file) => {
    const extension = file.name.split(".").pop()?.toLowerCase();
    return ["png", "jpg", "jpeg", "gif", "webp", "svg", "avif"].includes(extension);
  });
}

function isImagePath(value) {
  const extension = value.split(".").pop()?.toLowerCase();
  return ["png", "jpg", "jpeg", "gif", "webp", "svg", "avif"].includes(extension);
}

function relativeMarkdownLink(sourcePath, targetPath) {
  const sourceFolder = parentFolder(sourcePath);
  const relative = relativePath(sourceFolder, targetPath);
  const normalized = relative.startsWith(".") ? relative : `./${relative}`;
  return encodeURI(normalized).replace(/%5B/g, "[").replace(/%5D/g, "]");
}

function localImageUrl(target, sourcePath = "") {
  const decoded = decodeLink(target);
  if (/^[a-z]+:\/\//i.test(decoded)) return null;
  const clean = decoded.replace(/#.*$/, "").trim();
  const extension = clean.split(".").pop()?.toLowerCase();
  if (!["png", "jpg", "jpeg", "gif", "webp", "svg", "avif"].includes(extension)) return null;

  const sourceFolder = parentFolder(sourcePath);
  const relative = normalizeVaultPath(sourceFolder ? `${sourceFolder}/${clean}` : clean);
  if (!relative || !state.rootPath) return null;
  return `file://${encodeURI(`${state.rootPath}/${relative}`)}`;
}

function relativePath(fromFolder, toPath) {
  const fromParts = fromFolder ? fromFolder.split("/") : [];
  const toParts = toPath.split("/");
  while (fromParts.length && toParts.length && fromParts[0] === toParts[0]) {
    fromParts.shift();
    toParts.shift();
  }
  return [...fromParts.map(() => ".."), ...toParts].join("/") || `./${toPath.split("/").pop()}`;
}

function getTextareaCaretPosition(textarea, position) {
  const div = document.createElement("div");
  const style = getComputedStyle(textarea);
  const properties = [
    "boxSizing",
    "width",
    "height",
    "overflowX",
    "overflowY",
    "borderTopWidth",
    "borderRightWidth",
    "borderBottomWidth",
    "borderLeftWidth",
    "paddingTop",
    "paddingRight",
    "paddingBottom",
    "paddingLeft",
    "fontStyle",
    "fontVariant",
    "fontWeight",
    "fontStretch",
    "fontSize",
    "fontSizeAdjust",
    "lineHeight",
    "fontFamily",
    "textAlign",
    "textTransform",
    "textIndent",
    "textDecoration",
    "letterSpacing",
    "wordSpacing",
    "tabSize",
    "MozTabSize"
  ];

  div.style.position = "fixed";
  div.style.visibility = "hidden";
  div.style.whiteSpace = "pre-wrap";
  div.style.wordWrap = "break-word";
  properties.forEach((prop) => {
    div.style[prop] = style[prop];
  });
  div.textContent = textarea.value.substring(0, position);

  const span = document.createElement("span");
  span.textContent = textarea.value.substring(position) || ".";
  div.appendChild(span);
  document.body.appendChild(div);

  const textareaRect = textarea.getBoundingClientRect();
  const divRect = div.getBoundingClientRect();
  const spanRect = span.getBoundingClientRect();
  const result = {
    left: textareaRect.left + (spanRect.left - divRect.left) - textarea.scrollLeft,
    top: textareaRect.top + (spanRect.top - divRect.top) - textarea.scrollTop,
    height: parseFloat(style.lineHeight) || 20
  };

  document.body.removeChild(div);
  return result;
}

function getTextareaPositionFromPoint(textarea, clientX, clientY) {
  const nativePosition = getNativeTextareaPositionFromPoint(textarea, clientX, clientY);
  if (nativePosition !== null) return nativePosition;

  const value = textarea.value;
  if (!value) return 0;

  let low = 0;
  let high = value.length;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    const caret = getTextareaCaretPosition(textarea, mid);
    if (caret.top + caret.height < clientY) low = mid + 1;
    else high = mid;
  }

  const start = Math.max(0, low - 180);
  const end = Math.min(value.length, low + 180);
  let best = low;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (let index = start; index <= end; index += 1) {
    const caret = getTextareaCaretPosition(textarea, index);
    const dx = caret.left - clientX;
    const dy = caret.top + caret.height / 2 - clientY;
    const distance = dx * dx + dy * dy;
    if (distance < bestDistance) {
      best = index;
      bestDistance = distance;
    }
  }

  return best;
}

function getNativeTextareaPositionFromPoint(textarea, clientX, clientY) {
  if (typeof document.caretPositionFromPoint === "function") {
    const position = document.caretPositionFromPoint(clientX, clientY);
    if (position?.offsetNode === textarea) return clamp(position.offset, 0, textarea.value.length);
  }

  if (typeof document.caretRangeFromPoint === "function") {
    const range = document.caretRangeFromPoint(clientX, clientY);
    if (range?.startContainer === textarea) return clamp(range.startOffset, 0, textarea.value.length);
  }

  return null;
}

async function openNote(relativePath, options = {}) {
  log("openNote", relativePath);
  if (!state.rootPath || !state.noteByPath.has(relativePath)) return;
  if (!options.preservePreviewHistory) {
    state.previewHistory = [];
    state.previewForwardHistory = [];
  }
  const cursor = options.preserveCursor ? els.editor.selectionStart : 0;
  const content = await window.tektite.readNote(state.rootPath, relativePath);

  state.activePath = relativePath;
  state.selectedPath = relativePath;
  state.selectedType = "note";
  state.activeContent = content;
  state.noteContent.set(relativePath, content);
  els.editor.disabled = false;
  els.editor.value = content;
  els.noteTitle.textContent = state.noteByPath.get(relativePath).title;
  els.notePath.textContent = relativePath;
  els.editor.setSelectionRange(cursor, cursor);
  resetEditorHistory(content, cursor);
  renderTree();
  renderPreview(content);
  updatePreviewNavButtons();
  updateGraph();
  setSaveState("Saved");
}

function onEditorInput() {
  if (state.editorHistory.restoring) return;
  state.activeContent = els.editor.value;
  renderPreview(state.activeContent);
  updateMentionMenu();
  recordEditorHistory();
  setSaveState("Unsaved");
  clearTimeout(state.saveTimer);
  state.saveTimer = setTimeout(saveActiveNote, 450);
}

function resetEditorHistory(content, cursor = 0) {
  state.editorHistory = {
    path: state.activePath,
    stack: [{
      content,
      selectionStart: cursor,
      selectionEnd: cursor
    }],
    index: 0,
    restoring: false
  };
}

function recordEditorHistory() {
  if (!state.activePath || state.editorHistory.restoring) return;
  if (state.editorHistory.path !== state.activePath) {
    resetEditorHistory(els.editor.value, els.editor.selectionStart);
    return;
  }

  const snapshot = {
    content: els.editor.value,
    selectionStart: els.editor.selectionStart,
    selectionEnd: els.editor.selectionEnd
  };
  const current = state.editorHistory.stack[state.editorHistory.index];
  if (current?.content === snapshot.content && current.selectionStart === snapshot.selectionStart && current.selectionEnd === snapshot.selectionEnd) {
    return;
  }

  state.editorHistory.stack = state.editorHistory.stack.slice(0, state.editorHistory.index + 1);
  state.editorHistory.stack.push(snapshot);
  if (state.editorHistory.stack.length > 300) {
    state.editorHistory.stack.shift();
  }
  state.editorHistory.index = state.editorHistory.stack.length - 1;
}

function restoreEditorHistory(delta) {
  if (!state.activePath || state.editorHistory.path !== state.activePath) return;
  const nextIndex = state.editorHistory.index + delta;
  if (nextIndex < 0 || nextIndex >= state.editorHistory.stack.length) return;

  const snapshot = state.editorHistory.stack[nextIndex];
  state.editorHistory.index = nextIndex;
  state.editorHistory.restoring = true;
  els.editor.value = snapshot.content;
  els.editor.setSelectionRange(snapshot.selectionStart, snapshot.selectionEnd);
  state.activeContent = snapshot.content;
  renderPreview(state.activeContent);
  updateGraph();
  setSaveState("Unsaved");
  clearTimeout(state.saveTimer);
  state.saveTimer = setTimeout(saveActiveNote, 450);
  state.editorHistory.restoring = false;
}

function onEditorKeydown(event) {
  const key = event.key.toLowerCase();
  if ((event.metaKey || event.ctrlKey) && key === "z") {
    event.preventDefault();
    restoreEditorHistory(event.shiftKey ? 1 : -1);
    return;
  }
  if ((event.metaKey || event.ctrlKey) && key === "y") {
    event.preventDefault();
    restoreEditorHistory(1);
    return;
  }

  if (!state.mention.active) return;

  if (event.key === "ArrowDown") {
    event.preventDefault();
    state.mention.selectedIndex = Math.min(state.mention.selectedIndex + 1, state.mention.items.length - 1);
    renderMentionMenu();
  } else if (event.key === "ArrowUp") {
    event.preventDefault();
    state.mention.selectedIndex = Math.max(state.mention.selectedIndex - 1, 0);
    renderMentionMenu();
  } else if (event.key === "Enter" || event.key === "Tab") {
    event.preventDefault();
    insertMentionLink(state.mention.items[state.mention.selectedIndex]);
  } else if (event.key === "Escape") {
    event.preventDefault();
    closeMentionMenu();
  }
}

async function saveActiveNote() {
  if (!state.rootPath || !state.activePath) return;
  setSaveState("Saving...");
  await window.tektite.writeNote(state.rootPath, state.activePath, state.activeContent);
  state.noteContent.set(state.activePath, state.activeContent);
  setSaveState("Saved");
  const vault = await window.tektite.scanVault(state.rootPath);
  state.tree = vault.tree;
  state.notes = vault.notes;
  indexNotes();
  renderTree();
  updateGraph();
}

function showEmptyState(message = "Choose a local folder to start.") {
  state.activePath = null;
  state.activeContent = "";
  state.previewHistory = [];
  state.previewForwardHistory = [];
  els.editor.value = "";
  els.editor.disabled = true;
  resetEditorHistory("", 0);
  els.noteTitle.textContent = "Open a vault";
  els.notePath.textContent = message;
  els.preview.innerHTML = `<p class="empty-copy">${escapeHtml(message)}</p>`;
  updatePreviewNavButtons();
  updateGraph();
}

function indexNotes() {
  state.noteByPath = new Map(state.notes.map((note) => [note.path, note]));
  state.noteByTitle = new Map();

  for (const note of state.notes) {
    const aliases = new Set([
      note.title.toLowerCase(),
      note.path.toLowerCase(),
      note.path.replace(/\.md$/i, "").toLowerCase()
    ]);
    aliases.forEach((alias) => state.noteByTitle.set(alias, note));
  }
}

async function loadGraphContent() {
  log("loadGraphContent start", state.notes.length);
  const nextContent = new Map();
  await Promise.all(
    state.notes.map(async (note) => {
      try {
        nextContent.set(note.path, await window.tektite.readNote(state.rootPath, note.path));
      } catch {
        nextContent.set(note.path, "");
      }
    })
  );
  state.noteContent = nextContent;
  log("loadGraphContent complete");
}

function renderTree() {
  if (!state.tree) {
    els.fileTree.innerHTML = "";
    return;
  }

  const query = els.searchInput.value.trim().toLowerCase();
  els.fileTree.innerHTML = "";
  const fragment = document.createDocumentFragment();
  fragment.appendChild(renderVaultRootDropRow());
  const children = Array.isArray(state.tree.children) ? state.tree.children : [];
  for (const child of children) {
    const node = renderTreeNode(child, query);
    if (node) fragment.appendChild(node);
  }
  els.fileTree.appendChild(fragment);
}

function renderVaultRootDropRow() {
  const button = document.createElement("button");
  button.className = `tree-row vault-root-row${isSelected("", "folder") ? " selected" : ""}`;
  button.type = "button";
  button.dataset.path = "";
  button.dataset.type = "folder";
  button.innerHTML = `<span aria-hidden="true">⌂</span><span class="tree-label">${escapeHtml(state.tree.name || "Vault")}</span>`;
  button.addEventListener("click", () => selectEntry("", "folder"));
  return button;
}

function renderTreeNode(node, query) {
  if (node.type === "note" || node.type === "asset") {
    const label = displayNoteLabel(node);
    if (query && !node.title.toLowerCase().includes(query) && !node.path.toLowerCase().includes(query)) {
      return null;
    }

    const button = document.createElement("button");
    button.className = `tree-row${isSelected(node.path, node.type) ? " selected" : ""}${node.path === state.activePath ? " active" : ""}`;
    button.type = "button";
    button.draggable = true;
    button.dataset.path = node.path;
    button.dataset.type = node.type;
    button.innerHTML = `<span class="tree-kind-icon" aria-hidden="true">${node.type === "note" ? "◆" : "▧"}</span><span class="tree-label">${escapeHtml(label)}</span>`;
    button.addEventListener("click", () => {
      if (node.type === "note") openNote(node.path);
      else selectEntry(node.path, "asset");
    });
    return button;
  }

  const childNodes = Array.isArray(node.children) ? node.children : [];
  const renderedChildren = childNodes.map((child) => renderTreeNode(child, query)).filter(Boolean);
  if (query && renderedChildren.length === 0) return null;
  const isCollapsed = !query && state.collapsedFolders.has(node.path);

  const wrap = document.createElement("div");
  const header = document.createElement("div");
  header.className = "tree-row";
  header.setAttribute("aria-expanded", String(!isCollapsed));
  header.draggable = Boolean(node.path);
  header.dataset.path = node.path;
  header.dataset.type = "folder";
  if (isSelected(node.path, "folder")) header.classList.add("selected");

  const toggle = document.createElement("button");
  toggle.className = "tree-caret-button";
  toggle.type = "button";
  toggle.setAttribute("aria-label", isCollapsed ? "Expand folder" : "Collapse folder");
  toggle.innerHTML = `<span class="tree-caret" aria-hidden="true">${isCollapsed ? "▸" : "▾"}</span>`;
  toggle.addEventListener("click", () => toggleFolder(node.path));

  const label = document.createElement("button");
  label.className = "tree-label-button";
  label.type = "button";
  label.innerHTML = `<span class="tree-kind-icon tree-folder-icon" aria-hidden="true">▣</span><span class="tree-label">${escapeHtml(node.name)}</span>`;
  label.addEventListener("click", () => selectEntry(node.path, "folder"));

  header.append(toggle, label);
  const children = document.createElement("div");
  children.className = "tree-children";
  children.hidden = isCollapsed;
  renderedChildren.forEach((child) => children.appendChild(child));
  wrap.append(header, children);
  return wrap;
}

function onTreeContextMenu(event) {
  event.preventDefault();
  const context = contextFromTreeTarget(event.target);
  selectEntry(context.path, context.type);
  openTreeContextMenu(event.clientX, event.clientY, context);
}

function contextFromTreeTarget(target) {
  const row = target.closest?.("[data-path][data-type]");
  if (!row) return { path: targetFolder(), type: "folder" };
  return {
    path: row.dataset.path || "",
    type: row.dataset.type || "folder"
  };
}

function openTreeContextMenu(x, y, context) {
  const items = [
    {
      label: "New node",
      action: () => createNote(context)
    },
    {
      label: "New folder",
      action: () => createFolder(context)
    }
  ];

  if (context.path) {
    items.push({ type: "separator" });
    items.push({
      label: context.type === "folder" ? "Delete folder" : "Delete file",
      danger: true,
      action: () => deleteSelectedEntry(context)
    });
  }

  els.treeContextMenu.innerHTML = "";
  for (const item of items) {
    if (item.type === "separator") {
      const separator = document.createElement("div");
      separator.className = "context-menu-separator";
      els.treeContextMenu.appendChild(separator);
      continue;
    }

    const button = document.createElement("button");
    button.type = "button";
    button.className = `context-menu-item${item.danger ? " danger" : ""}`;
    button.textContent = item.label;
    button.addEventListener("click", () => {
      closeTreeContextMenu();
      item.action();
    });
    els.treeContextMenu.appendChild(button);
  }

  els.treeContextMenu.classList.remove("hidden");
  const rect = els.treeContextMenu.getBoundingClientRect();
  els.treeContextMenu.style.left = `${Math.min(x, window.innerWidth - rect.width - 8)}px`;
  els.treeContextMenu.style.top = `${Math.min(y, window.innerHeight - rect.height - 8)}px`;
}

function closeTreeContextMenu() {
  els.treeContextMenu.classList.add("hidden");
}

function toggleFolder(folderPath) {
  if (state.collapsedFolders.has(folderPath)) {
    state.collapsedFolders.delete(folderPath);
  } else {
    state.collapsedFolders.add(folderPath);
  }
  saveCollapsedFolders();
  renderTree();
}

function selectEntry(path, type) {
  state.selectedPath = path;
  state.selectedType = type;
  renderTree();
}

function isSelected(path, type) {
  return state.selectedPath === path && state.selectedType === type;
}

function displayNoteLabel(note) {
  if (!note) return "";
  return state.showFileExtensions ? note.name : note.title;
}

function loadCollapsedFolders() {
  const key = collapsedFoldersKey();
  try {
    state.collapsedFolders = new Set(JSON.parse(localStorage.getItem(key) || "[]"));
  } catch {
    state.collapsedFolders = new Set();
  }
}

function saveCollapsedFolders() {
  localStorage.setItem(collapsedFoldersKey(), JSON.stringify([...state.collapsedFolders]));
}

function collapsedFoldersKey() {
  return `tektite:collapsed:${state.rootPath || "none"}`;
}

function renderPreview(markdown) {
  els.preview.innerHTML = markdownToHtml(markdown, state.activePath);
}

function markdownToHtml(markdown, sourcePath = "") {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const blocks = [];
  let paragraph = [];
  let list = [];
  let inCode = false;
  let code = [];

  function flushParagraph() {
    if (paragraph.length) {
      blocks.push(`<p>${inlineMarkdown(paragraph.join(" "), sourcePath)}</p>`);
      paragraph = [];
    }
  }

  function flushList() {
    if (list.length) {
      blocks.push(`<ul>${list.map((item) => `<li>${inlineMarkdown(item, sourcePath)}</li>`).join("")}</ul>`);
      list = [];
    }
  }

  for (const line of lines) {
    if (line.startsWith("```")) {
      if (inCode) {
        blocks.push(`<pre><code>${escapeHtml(code.join("\n"))}</code></pre>`);
        inCode = false;
        code = [];
      } else {
        flushParagraph();
        flushList();
        inCode = true;
      }
      continue;
    }

    if (inCode) {
      code.push(line);
      continue;
    }

    if (!line.trim()) {
      flushParagraph();
      flushList();
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      flushList();
      const level = heading[1].length;
      blocks.push(`<h${level}>${inlineMarkdown(heading[2], sourcePath)}</h${level}>`);
      continue;
    }

    if (/^---+$/.test(line.trim())) {
      flushParagraph();
      flushList();
      blocks.push("<hr>");
      continue;
    }

    const listItem = line.match(/^\s*[-*+]\s+(.+)$/);
    if (listItem) {
      flushParagraph();
      list.push(listItem[1]);
      continue;
    }

    const quote = line.match(/^>\s?(.*)$/);
    if (quote) {
      flushParagraph();
      flushList();
      blocks.push(`<blockquote>${inlineMarkdown(quote[1], sourcePath)}</blockquote>`);
      continue;
    }

    paragraph.push(line.trim());
  }

  flushParagraph();
  flushList();
  if (inCode) blocks.push(`<pre><code>${escapeHtml(code.join("\n"))}</code></pre>`);
  return blocks.join("\n") || "<p>Start writing.</p>";
}

function inlineMarkdown(value, sourcePath = "") {
  const tokens = [];
  let text = escapeHtml(value);

  text = text.replace(/`([^`]+)`/g, (_match, code) => {
    const token = stash(tokens, `<code>${code}</code>`);
    return token;
  });

  text = text.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_match, alt, href) => {
    const imageUrl = localImageUrl(href, sourcePath);
    const token = stash(
      tokens,
      imageUrl
        ? `<img src="${escapeAttr(imageUrl)}" alt="${escapeAttr(alt)}">`
        : `<span>${alt}</span>`
    );
    return token;
  });

  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, label, href) => {
    const decoded = decodeLink(href);
    const note = resolveNote(decoded, sourcePath);
    if (note) {
      return stash(tokens, `<a href="#" data-note-path="${escapeAttr(note.path)}">${label}</a>`);
    }
    if (/^https?:\/\//i.test(decoded)) {
      return stash(tokens, `<a href="${escapeAttr(decoded)}" target="_blank" rel="noreferrer">${label}</a>`);
    }
    return stash(tokens, `<span class="wiki-link missing">${label}</span>`);
  });

  text = text.replace(/\[\[([^\]]+)\]\]/g, (_match, target) => {
    const [rawTarget, alias] = target.split("|");
    const note = resolveNote(rawTarget, sourcePath);
    const label = alias || rawTarget.replace(/#.*$/, "");
    const className = note ? "wiki-link" : "wiki-link missing";
    const data = note ? ` data-note-path="${escapeAttr(note.path)}"` : "";
    return stash(tokens, `<a href="#" class="${className}"${data}>${escapeHtml(label)}</a>`);
  });

  text = text
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>");

  return restore(tokens, text);
}

function resolveNote(target, sourcePath = "") {
  const clean = decodeLink(target)
    .replace(/^\/+/, "")
    .replace(/#.*$/, "")
    .replace(/\|.*$/, "")
    .trim();

  if (!clean) return null;
  const candidates = buildNoteCandidates(clean, sourcePath);

  for (const candidate of candidates) {
    if (state.noteByTitle.has(candidate)) return state.noteByTitle.get(candidate);
  }

  return null;
}

function buildNoteCandidates(target, sourcePath = "") {
  const sourceFolder = sourcePath.includes("/") ? sourcePath.split("/").slice(0, -1).join("/") : "";
  const cleanedTarget = normalizeNoteTarget(target);
  const withoutExtension = cleanedTarget.replace(/\.md$/i, "");
  const withExtension = cleanedTarget.endsWith(".md") ? cleanedTarget : `${cleanedTarget}.md`;
  const relativeTarget = normalizeVaultPath(sourceFolder ? `${sourceFolder}/${cleanedTarget}` : cleanedTarget);
  const relativeWithoutExtension = relativeTarget.replace(/\.md$/i, "");
  const relativeWithExtension = relativeTarget.endsWith(".md") ? relativeTarget : `${relativeTarget}.md`;

  return unique([
    cleanedTarget,
    withExtension,
    withoutExtension,
    relativeTarget,
    relativeWithExtension,
    relativeWithoutExtension,
    basenameWithoutExtension(cleanedTarget),
    basenameWithoutExtension(withExtension)
  ].map((candidate) => candidate.toLowerCase()));
}

function normalizeNoteTarget(target) {
  return normalizeVaultPath(target.replace(/\\/g, "/").replace(/^\.\/+/, ""));
}

function normalizeVaultPath(value) {
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

function basenameWithoutExtension(value) {
  const base = value.split("/").pop() || value;
  return base.replace(/\.md$/i, "");
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function decodeLink(value) {
  const trimmed = value.trim().replace(/^<|>$/g, "");
  try {
    return decodeURIComponent(trimmed);
  } catch {
    return trimmed;
  }
}

function updateGraph() {
  if (!state.notes.length) {
    drawGraph({ nodes: [], edges: [] });
    return;
  }

  const links = parseLinksFromNotes();
  drawGraph(links);
}

function parseLinksFromNotes() {
  const nodes = state.notes.map((note) => ({
    id: note.path,
    title: note.title,
    active: note.path === state.activePath,
    degree: 0
  }));
  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  const edges = [];

  for (const note of state.notes) {
    const sourceContent =
      note.path === state.activePath ? state.activeContent : state.noteContent.get(note.path) || "";
    const targets = extractTargets(sourceContent);

    for (const target of targets) {
      const resolved = resolveNote(target, note.path);
      if (!resolved || resolved.path === note.path) continue;
      edges.push({ source: note.path, target: resolved.path });
      nodeMap.get(note.path).degree += 1;
      nodeMap.get(resolved.path).degree += 1;
    }
  }

  return { nodes, edges };
}

function extractTargets(markdown) {
  const targets = [];
  const wiki = /\[\[([^\]]+)\]\]/g;
  const md = /(?<!!)\[[^\]]+\]\(([^)]+)\)/g;
  let match;

  while ((match = wiki.exec(markdown))) targets.push(match[1]);
  while ((match = md.exec(markdown))) targets.push(match[1]);
  return targets;
}

function drawGraph({ nodes, edges }) {
  const svg = els.graphSvg;
  const theme = getComputedStyle(document.documentElement);
  const graphEdge = theme.getPropertyValue("--graph-edge").trim() || "#557b7f";
  const graphNode = theme.getPropertyValue("--graph-node").trim() || "#25272d";
  const accent = theme.getPropertyValue("--accent").trim() || "#65a8ad";
  const accentDark = theme.getPropertyValue("--accent-dark").trim() || "#7fb9bd";
  const ink = theme.getPropertyValue("--ink").trim() || "#ece6da";
  const rect = svg.getBoundingClientRect();
  const width = Math.max(rect.width || 720, 480);
  const height = Math.max(rect.height || 520, 420);
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.min(width, height) * 0.35;

  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.innerHTML = "";
  els.graphEmpty.classList.toggle("hidden", nodes.length > 0 && edges.length > 0);

  if (!nodes.length) return;

  nodes.forEach((node, index) => {
    const saved = state.graphPositions.get(node.id);
    if (saved) {
      node.x = saved.x;
      node.y = saved.y;
    } else {
      const angle = (Math.PI * 2 * index) / nodes.length - Math.PI / 2;
      node.x = centerX + Math.cos(angle) * radius;
      node.y = centerY + Math.sin(angle) * radius;
    }
  });

  const hasSavedLayout = nodes.some((node) => state.graphPositions.has(node.id));
  for (let tick = 0; tick < (hasSavedLayout ? 24 : 180); tick += 1) {
    for (let i = 0; i < nodes.length; i += 1) {
      for (let j = i + 1; j < nodes.length; j += 1) {
        const a = nodes[i];
        const b = nodes[j];
        const dx = a.x - b.x || 0.01;
        const dy = a.y - b.y || 0.01;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const force = Math.min(1200 / (distance * distance), 2.6);
        a.x += (dx / distance) * force;
        a.y += (dy / distance) * force;
        b.x -= (dx / distance) * force;
        b.y -= (dy / distance) * force;
      }
    }

    for (const edge of edges) {
      const source = nodes.find((node) => node.id === edge.source);
      const target = nodes.find((node) => node.id === edge.target);
      if (!source || !target) continue;
      const dx = target.x - source.x;
      const dy = target.y - source.y;
      source.x += dx * 0.006;
      source.y += dy * 0.006;
      target.x -= dx * 0.006;
      target.y -= dy * 0.006;
    }

    for (const node of nodes) {
      node.x += (centerX - node.x) * 0.012;
      node.y += (centerY - node.y) * 0.012;
      node.x = Math.max(48, Math.min(width - 48, node.x));
      node.y = Math.max(44, Math.min(height - 44, node.y));
    }
  }

  nodes.forEach((node) => {
    state.graphPositions.set(node.id, { x: node.x, y: node.y });
  });

  const edgeLayer = document.createElementNS("http://www.w3.org/2000/svg", "g");
  const nodeLayer = document.createElementNS("http://www.w3.org/2000/svg", "g");
  const viewportLayer = document.createElementNS("http://www.w3.org/2000/svg", "g");
  viewportLayer.setAttribute("class", "graph-viewport");
  applyGraphViewport(viewportLayer);
  const nodeMap = new Map(nodes.map((node) => [node.id, node]));

  for (const edge of edges) {
    const source = nodeMap.get(edge.source);
    const target = nodeMap.get(edge.target);
    if (!source || !target) continue;
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", source.x);
    line.setAttribute("y1", source.y);
    line.setAttribute("x2", target.x);
    line.setAttribute("y2", target.y);
    line.setAttribute("stroke", graphEdge);
    line.setAttribute("stroke-width", "1.4");
    line.dataset.source = edge.source;
    line.dataset.target = edge.target;
    edgeLayer.appendChild(line);
  }

  for (const node of nodes) {
    const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
    group.setAttribute("data-note-path", node.id);
    group.setAttribute("class", "graph-node");
    group.style.cursor = "pointer";

    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("cx", node.x);
    circle.setAttribute("cy", node.y);
    circle.setAttribute("r", 8 + Math.min(node.degree, 8) * 1.6);
    circle.setAttribute("fill", node.active ? accent : graphNode);
    circle.setAttribute("stroke", node.active ? accentDark : accent);
    circle.setAttribute("stroke-width", node.active ? "3" : "2");

    const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
    label.setAttribute("x", node.x + 13);
    label.setAttribute("y", node.y + 4);
    label.setAttribute("fill", ink);
    label.setAttribute("font-size", "12");
    label.setAttribute("font-weight", node.active ? "700" : "560");
    label.textContent = node.title;

    group.append(circle, label);
    nodeLayer.appendChild(group);
  }

  viewportLayer.append(edgeLayer, nodeLayer);
  svg.append(viewportLayer);
}

function onGraphWheel(event) {
  event.preventDefault();
  const svg = els.graphSvg;
  const rect = svg.getBoundingClientRect();
  const pointX = event.clientX - rect.left;
  const pointY = event.clientY - rect.top;
  const previousScale = state.graphViewport.scale;
  const nextScale = clamp(previousScale * (event.deltaY < 0 ? 1.12 : 0.89), 0.35, 3.5);
  const scaleRatio = nextScale / previousScale;

  state.graphViewport.x = pointX - (pointX - state.graphViewport.x) * scaleRatio;
  state.graphViewport.y = pointY - (pointY - state.graphViewport.y) * scaleRatio;
  state.graphViewport.scale = nextScale;

  const viewportLayer = svg.querySelector(".graph-viewport");
  if (viewportLayer) applyGraphViewport(viewportLayer);
}

function onGraphPointerDown(event) {
  if (event.button !== 0) return;
  const node = event.target.closest("[data-note-path]");
  const graphPoint = graphPointFromEvent(event);
  const notePath = node?.dataset.notePath || null;
  const savedPosition = notePath ? state.graphPositions.get(notePath) : null;
  state.graphDrag = {
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    startGraphX: graphPoint.x,
    startGraphY: graphPoint.y,
    nodeStartX: savedPosition?.x || graphPoint.x,
    nodeStartY: savedPosition?.y || graphPoint.y,
    viewportX: state.graphViewport.x,
    viewportY: state.graphViewport.y,
    didMove: false,
    mode: notePath ? "node" : "pan",
    notePath
  };
  event.preventDefault();
  els.graphSvg.setPointerCapture(event.pointerId);
  els.graphSvg.classList.add(notePath ? "dragging-node" : "panning");
  window.addEventListener("pointermove", onGraphPointerMove);
  window.addEventListener("pointerup", stopGraphPan, { once: true });
  window.addEventListener("pointercancel", stopGraphPan, { once: true });
}

function onGraphPointerMove(event) {
  if (!state.graphDrag) return;
  const dx = event.clientX - state.graphDrag.startX;
  const dy = event.clientY - state.graphDrag.startY;
  if (Math.abs(dx) + Math.abs(dy) > 3) state.graphDrag.didMove = true;

  if (state.graphDrag.mode === "node") {
    const graphPoint = graphPointFromEvent(event);
    const next = {
      x: state.graphDrag.nodeStartX + graphPoint.x - state.graphDrag.startGraphX,
      y: state.graphDrag.nodeStartY + graphPoint.y - state.graphDrag.startGraphY
    };
    state.graphPositions.set(state.graphDrag.notePath, next);
    moveGraphNodeElement(state.graphDrag.notePath, next.x, next.y);
  } else {
    state.graphViewport.x = state.graphDrag.viewportX + dx;
    state.graphViewport.y = state.graphDrag.viewportY + dy;
    const viewportLayer = els.graphSvg.querySelector(".graph-viewport");
    if (viewportLayer) applyGraphViewport(viewportLayer);
  }
}

function stopGraphPan() {
  if (!state.graphDrag) return;
  const notePath = state.graphDrag.notePath;
  const shouldOpen = state.graphDrag.mode === "node" && notePath && !state.graphDrag.didMove;
  state.graphDrag = null;
  els.graphSvg.classList.remove("panning");
  els.graphSvg.classList.remove("dragging-node");
  window.removeEventListener("pointermove", onGraphPointerMove);
  window.removeEventListener("pointercancel", stopGraphPan);
  if (shouldOpen) openNote(notePath);
}

function graphPointFromEvent(event) {
  const rect = els.graphSvg.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left - state.graphViewport.x) / state.graphViewport.scale,
    y: (event.clientY - rect.top - state.graphViewport.y) / state.graphViewport.scale
  };
}

function moveGraphNodeElement(notePath, x, y) {
  const group = els.graphSvg.querySelector(`.graph-node[data-note-path="${cssEscape(notePath)}"]`);
  if (!group) return;
  const circle = group.querySelector("circle");
  const label = group.querySelector("text");
  circle?.setAttribute("cx", x);
  circle?.setAttribute("cy", y);
  label?.setAttribute("x", x + 13);
  label?.setAttribute("y", y + 4);

  els.graphSvg.querySelectorAll(`[data-source="${cssEscape(notePath)}"]`).forEach((line) => {
    line.setAttribute("x1", x);
    line.setAttribute("y1", y);
  });
  els.graphSvg.querySelectorAll(`[data-target="${cssEscape(notePath)}"]`).forEach((line) => {
    line.setAttribute("x2", x);
    line.setAttribute("y2", y);
  });
}

function applyGraphViewport(element) {
  element.setAttribute(
    "transform",
    `translate(${state.graphViewport.x} ${state.graphViewport.y}) scale(${state.graphViewport.scale})`
  );
}

function onPreviewClick(event) {
  const link = event.target.closest("[data-note-path]");
  if (!link) return;
  event.preventDefault();
  openNoteFromPreviewLink(link.dataset.notePath);
}

function openNoteFromPreviewLink(notePath) {
  if (!notePath || notePath === state.activePath || !state.noteByPath.has(notePath)) return;
  if (state.activePath) {
    const lastPath = state.previewHistory[state.previewHistory.length - 1];
    if (lastPath !== state.activePath) state.previewHistory.push(state.activePath);
  }
  state.previewForwardHistory = [];
  openNote(notePath, { preservePreviewHistory: true });
}

function goBackPreviewHistory() {
  const previousPath = state.previewHistory.pop();
  if (!previousPath) return updatePreviewNavButtons();
  if (state.activePath) state.previewForwardHistory.push(state.activePath);
  openNote(previousPath, { preservePreviewHistory: true });
}

function goForwardPreviewHistory() {
  const nextPath = state.previewForwardHistory.pop();
  if (!nextPath) return updatePreviewNavButtons();
  if (state.activePath) state.previewHistory.push(state.activePath);
  openNote(nextPath, { preservePreviewHistory: true });
}

function updatePreviewNavButtons() {
  els.previewBackButton.disabled = state.previewHistory.length === 0;
  els.previewForwardButton.disabled = state.previewForwardHistory.length === 0;
}

function onGraphClick(event) {
  if (state.graphDrag) return;
  const node = event.target.closest("[data-note-path]");
  if (!node) return;
  event.preventDefault();
  openNote(node.dataset.notePath);
}

function activeFolder() {
  if (!state.activePath) return "";
  const parts = state.activePath.split("/");
  parts.pop();
  return parts.join("/");
}

function targetFolder() {
  if (state.selectedType === "folder") return state.selectedPath || "";
  if (state.selectedType === "note" && state.selectedPath) return parentFolder(state.selectedPath);
  return activeFolder();
}

function folderForContext(context) {
  if (!context || !context.path) return "";
  if (context.type === "folder") return context.path;
  return parentFolder(context.path);
}

function currentSelection() {
  if (state.selectedPath) {
    return { path: state.selectedPath, type: state.selectedType };
  }
  if (state.activePath) {
    return { path: state.activePath, type: "note" };
  }
  return { path: "", type: "folder" };
}

function parentFolder(relativePath) {
  const parts = relativePath.split("/");
  parts.pop();
  return parts.join("/");
}

function isPathInside(path, folder) {
  if (!path || !folder) return false;
  return path === folder || path.startsWith(`${folder}/`);
}

function entryExists(path, type) {
  if (!path) return type === "folder";
  if (type === "note") return state.noteByPath.has(path);
  if (type === "asset") return treeEntryExists(state.tree, path, "asset");
  return folderExists(state.tree, path);
}

function folderExists(node, path) {
  if (!node || node.type !== "folder") return false;
  if (node.path === path) return true;
  const children = Array.isArray(node.children) ? node.children : [];
  return children.some((child) => folderExists(child, path));
}

function treeEntryExists(node, path, type) {
  if (!node) return false;
  if (node.path === path && node.type === type) return true;
  const children = Array.isArray(node.children) ? node.children : [];
  return children.some((child) => treeEntryExists(child, path, type));
}

function setSaveState(value) {
  els.saveState.textContent = value;
}

function stash(tokens, html) {
  const token = `\u0000${tokens.length}\u0000`;
  tokens.push(html);
  return token;
}

function restore(tokens, text) {
  return text.replace(/\u0000(\d+)\u0000/g, (_match, index) => tokens[Number(index)]);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, "&#096;");
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function cssEscape(value) {
  if (window.CSS?.escape) return window.CSS.escape(value);
  return String(value).replace(/["\\]/g, "\\$&");
}
