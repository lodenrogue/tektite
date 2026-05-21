const state = {
  rootPath: null,
  tree: null,
  notes: [],
  noteByPath: new Map(),
  noteByTitle: new Map(),
  noteContent: new Map(),
  activePath: null,
  activeType: null,
  activeContent: "",
  openTabs: [],
  selectedPath: "",
  selectedType: "folder",
  showFileExtensions: false,
  hasGitRepo: false,
  gitProvider: null,
  gitSyncInProgress: false,
  gitOutputUnsubscribe: null,
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
  graphLayoutSignature: "",
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

const WORKSPACE_STORAGE_PREFIX = "tektite:workspace:";

const verbose = new URLSearchParams(globalThis.location.search).has("debug") ||
  localStorage.getItem("tektite:verbose") === "1";

function log(...args) {
  if (verbose) console.log("[tektite:renderer]", ...args);
}

const els = {
  vaultName: document.getElementById("vaultName"),
  openVaultButton: document.getElementById("openVaultButton"),
  refreshButton: document.getElementById("refreshButton"),
  gitSyncButton: document.getElementById("gitSyncButton"),
  githubSyncButton: document.getElementById("githubSyncButton"),
  themeButton: document.getElementById("themeButton"),
  themeIcon: document.getElementById("themeIcon"),
  suffixButton: document.getElementById("suffixButton"),
  suffixIcon: document.getElementById("suffixIcon"),
  searchInput: document.getElementById("searchInput"),
  fileTree: document.getElementById("fileTree"),
  noteTitle: document.getElementById("noteTitle"),
  notePath: document.getElementById("notePath"),
  saveState: document.getElementById("saveState"),
  editorTabs: document.getElementById("editorTabs"),
  editor: document.getElementById("editor"),
  imageViewer: document.getElementById("imageViewer"),
  imageViewerImage: document.getElementById("imageViewerImage"),
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
  cancelNameXButton: document.getElementById("cancelNameXButton"),
  gitOutputDialog: document.getElementById("gitOutputDialog"),
  gitOutputText: document.getElementById("gitOutputText"),
  closeGitOutputButton: document.getElementById("closeGitOutputButton"),
  closeGitOutputXButton: document.getElementById("closeGitOutputXButton")
};

boot();

function boot() {
  loadLayout();
  applyLayout();
  state.showFileExtensions = localStorage.getItem("tektite:showFileExtensions") === "1";
  updateSuffixButton();
  els.openVaultButton.addEventListener("click", chooseVault);
  els.refreshButton.addEventListener("click", refreshVault);
  els.gitSyncButton.addEventListener("click", syncGitVault);
  els.githubSyncButton.addEventListener("click", syncGitVault);
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
  els.closeGitOutputButton.addEventListener("click", closeGitOutputDialog);
  els.closeGitOutputXButton.addEventListener("click", closeGitOutputDialog);
  els.gitOutputDialog.addEventListener("click", (event) => {
    if (event.target === els.gitOutputDialog) closeGitOutputDialog();
  });
  globalThis.addEventListener("keydown", (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "r") {
      event.preventDefault();
      refreshVault();
      return;
    }
    if (event.key === "Escape") closeTreeContextMenu();
    if (event.key === "Escape" && !els.nameDialog.classList.contains("hidden")) {
      closeNameDialog(null);
    }
    if (event.key === "Escape" && !els.gitOutputDialog.classList.contains("hidden")) {
      closeGitOutputDialog();
    }
  });
  globalThis.addEventListener("click", (event) => {
    if (!event.target.closest?.("#treeContextMenu")) closeTreeContextMenu();
  });
  globalThis.addEventListener("resize", () => {
    applyLayout();
    updateGraph();
  });
  globalThis.addEventListener("beforeunload", saveWorkspaceState);

  globalThis.tektite.onOpenVault(chooseVault);
  globalThis.tektite.onOpenRecentVault(openVault);
  globalThis.tektite.onNewNote(createNote);
  globalThis.tektite.onCloseTab(closeActiveEditorTab);
  globalThis.tektite.onRefreshVault(refreshVault);

  applyTheme(localStorage.getItem("tektite:theme") || "dark");
  if (new URLSearchParams(globalThis.location.search).get("restoreLastVault") !== "0") {
    restoreLastVault().catch(() => showEmptyState());
  } else {
    showEmptyState();
  }
}

async function restoreLastVault() {
  const persisted = await globalThis.tektite.loadWorkspaceState("");
  const lastVault = persisted?.lastVault || localStorage.getItem("tektite:lastVault");
  if (!lastVault) return;

  try {
    await openVault(lastVault);
  } catch {
    localStorage.removeItem("tektite:lastVault");
    showEmptyState();
  }
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
  const windowWidth = globalThis.innerWidth || 1200;
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
  globalThis.addEventListener("pointermove", onResizeMove);
  globalThis.addEventListener("pointerup", stopResize, { once: true });
  globalThis.addEventListener("pointercancel", stopResize, { once: true });
}

function onResizeMove(event) {
  if (!state.activeResize) return;
  const resize = state.activeResize;

  if (resize.target === "sidebar") {
    const nextWidth = resize.startSidebarWidth + event.clientX - resize.startX;
    const maxSidebar = Math.max(220, Math.min(620, globalThis.innerWidth - 720));
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
  document.body.classList.remove("resizing", "resizing-y");
  globalThis.removeEventListener("pointermove", onResizeMove);
  globalThis.removeEventListener("pointercancel", stopResize);
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
  els.themeIcon.dataset.mode = nextTheme;
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
  renderEditorTabs();
}

function updateSuffixButton() {
  els.suffixIcon.textContent = state.showFileExtensions ? "abc" : ".md";
  const label = state.showFileExtensions ? "Hide File Suffixes" : "Show File Suffixes";
  els.suffixButton.dataset.tooltip = label;
  els.suffixButton.setAttribute("aria-label", label);
}

function updateGitSyncButton() {
  const disabled = !state.rootPath || !state.hasGitRepo || state.gitSyncInProgress;
  const showGithub = state.hasGitRepo && state.gitProvider === "github";
  const showGenericGit = state.hasGitRepo && !showGithub;
  els.gitSyncButton.classList.toggle("hidden", !showGenericGit);
  els.githubSyncButton.classList.toggle("hidden", !showGithub);
  els.gitSyncButton.disabled = disabled || !showGenericGit;
  els.githubSyncButton.disabled = disabled || !showGithub;
}

async function chooseVault() {
  log("chooseVault start");
  const rootPath = await globalThis.tektite.chooseVault();
  if (!rootPath) return;
  await openVault(rootPath);
}

async function syncGitVault() {
  if (!state.rootPath || !state.hasGitRepo || state.gitSyncInProgress) return;

  state.gitSyncInProgress = true;
  updateGitSyncButton();
  setSaveState("Syncing...");
  showGitOutputDialog("Preparing Git sync...\n\n");

  try {
    await flushActiveNote();
    clearGitOutputSubscription();
    state.gitOutputUnsubscribe = globalThis.tektite.onGitSyncOutput(onGitSyncOutput);
    const result = await globalThis.tektite.syncGit(state.rootPath);
    await refreshVault({ flush: false });
    setSaveState(result.ok ? "Synced" : "Git sync failed");
  } catch (error) {
    console.error("[tektite:renderer] syncGitVault failed", error);
    setSaveState("Git sync failed");
    appendGitOutput(`${error.message || "Git sync failed."}\n`);
  } finally {
    clearGitOutputSubscription();
    state.gitSyncInProgress = false;
    updateGitSyncButton();
    setGitOutputCloseState(false);
  }
}

async function openVault(rootPath) {
  log("openVault start", rootPath);
  setSaveState("Opening...");
  try {
    const vault = await globalThis.tektite.scanVault(rootPath);
    log("openVault scan complete", { notes: vault.notes.length });
    state.rootPath = vault.rootPath;
    state.tree = vault.tree;
    state.notes = vault.notes;
    state.hasGitRepo = Boolean(vault.hasGitRepo);
    state.gitProvider = vault.gitProvider || null;
    state.activePath = null;
    state.activeType = null;
    state.activeContent = "";
    state.openTabs = [];
    state.selectedPath = "";
    state.selectedType = "folder";
    state.previewHistory = [];
    state.previewForwardHistory = [];
    loadCollapsedFolders();
    indexNotes();
    await loadGraphContent();

    localStorage.setItem("tektite:lastVault", rootPath);
    els.vaultName.textContent = rootPath.split(/[\\/]/).pop() || rootPath;
    updateGitSyncButton();
    renderTree();
    updateGraph();

    renderEditorTabs();
    if (await restoreWorkspaceState()) {
      setSaveState(state.activeType === "asset" ? "Read-only" : "Saved");
    } else if (state.notes.length > 0) {
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

async function refreshVault(options = {}) {
  log("refreshVault start");
  if (!state.rootPath) return chooseVault();
  const activePath = state.activePath;
  const activeType = state.activeType;
  const selectedPath = state.selectedPath;
  const selectedType = state.selectedType;
  if (options.flush !== false) await flushActiveNote();
  const vault = await globalThis.tektite.scanVault(state.rootPath);
  state.tree = vault.tree;
  state.notes = vault.notes;
  state.hasGitRepo = Boolean(vault.hasGitRepo);
  state.gitProvider = vault.gitProvider || null;
  indexNotes();
  reconcileOpenTabs();
  await loadGraphContent();
  if (selectedPath && entryExists(selectedPath, selectedType)) {
    state.selectedPath = selectedPath;
    state.selectedType = selectedType;
  } else if (activePath && entryExists(activePath, activeType)) {
    state.selectedPath = activePath;
    state.selectedType = activeType;
  } else {
    state.selectedPath = "";
    state.selectedType = "folder";
  }
  renderTree();
  renderEditorTabs();
  updateGitSyncButton();
  updateGraph();
  if (activePath && entryExists(activePath, activeType)) await activateTab(activePath, activeType, { preserveCursor: true });
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
    const newPath = await globalThis.tektite.createNote(state.rootPath, requestedName, folder);
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
    const newPath = await globalThis.tektite.createFolder(state.rootPath, requestedName, folderForContext(context));
    state.collapsedFolders.delete(parentFolder(newPath));
    await refreshVault();
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
  if (!globalThis.confirm(message)) return;

  try {
    clearTimeout(state.saveTimer);
    await globalThis.tektite.deleteEntry(state.rootPath, selection.path, selection.type);
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

async function renameSelectedEntry(context = currentSelection()) {
  if (!state.rootPath || !context?.path) return;

  const currentName = context.path.split("/").pop() || context.path;
  const defaultName = context.type === "note" ? currentName.replace(/\.md$/i, "") : currentName;
  const requestedName = await openNameDialog({
    title: context.type === "folder" ? "Rename folder" : "Rename file",
    defaultName,
    confirmLabel: "Rename"
  });
  if (requestedName === null) return;

  try {
    if (state.activePath) await saveActiveNote();
    clearTimeout(state.saveTimer);
    const newPath = await globalThis.tektite.renameEntry(state.rootPath, context.path, context.type, requestedName);
    const previousActivePath = state.activePath;
    await refreshVault();

    await reopenRenamedEntry(context, previousActivePath, newPath);
    setSaveState("Renamed");
  } catch (error) {
    console.error("[tektite:renderer] renameSelectedEntry failed", error);
    setSaveState("Failed");
  }
}

async function reopenRenamedEntry(context, previousActivePath, newPath) {
  if (context.type === "note" && previousActivePath === context.path) {
    await openNote(newPath);
    return;
  }
  if (context.type === "asset" && previousActivePath === context.path) {
    await openAsset(newPath);
    return;
  }
  if (context.type === "folder" && isPathInside(previousActivePath, context.path)) {
    await openMovedActiveEntry(pathAfterMove(previousActivePath, context.path, newPath));
    return;
  }
  if (context.type !== "folder") selectEntry(newPath, context.type);
}

async function openMovedActiveEntry(path) {
  if (!path) return;
  if (state.noteByPath.has(path)) {
    await openNote(path);
    return;
  }
  if (treeEntryExists(state.tree, path, "asset")) await openAsset(path);
}

function openNameDialog({ title, defaultName, confirmLabel = "Create" }) {
  return new Promise((resolve) => {
    state.nameDialogResolve = resolve;
    els.nameDialogTitle.textContent = title;
    els.confirmNameButton.textContent = confirmLabel;
    els.nameInput.value = defaultName;
    els.nameDialog.setAttribute("open", "");
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
  els.nameDialog.removeAttribute("open");
  const resolve = state.nameDialogResolve;
  state.nameDialogResolve = null;
  resolve(value);
}

function updateMentionMenu() {
  if (state.activeType !== "note" || !state.activePath || document.activeElement !== els.editor) {
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

  state.mention = {
    active: true,
    start,
    query,
    selectedIndex: state.mention.query === query ? Math.min(state.mention.selectedIndex, items.length) : 0,
    items
  };
  renderMentionMenu();
  positionMentionMenu();
}

function renderMentionMenu() {
  if (!state.mention.active) return;
  els.mentionMenu.innerHTML = "";
  const newNodeOption = document.createElement("button");
  newNodeOption.type = "button";
  newNodeOption.className = `mention-option mention-action${state.mention.selectedIndex === 0 ? " active" : ""}`;
  newNodeOption.setAttribute("role", "option");
  newNodeOption.setAttribute("aria-selected", String(state.mention.selectedIndex === 0));
  newNodeOption.innerHTML = `<span>New Node</span><small>${escapeHtml(mentionDefaultName())}</small>`;
  newNodeOption.addEventListener("mousedown", (event) => {
    event.preventDefault();
    createMentionNode();
  });
  els.mentionMenu.appendChild(newNodeOption);

  state.mention.items.forEach((note, index) => {
    const optionIndex = index + 1;
    const option = document.createElement("button");
    option.type = "button";
    option.className = `mention-option${optionIndex === state.mention.selectedIndex ? " active" : ""}`;
    option.setAttribute("role", "option");
    option.setAttribute("aria-selected", String(optionIndex === state.mention.selectedIndex));
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

async function createMentionNode() {
  if (!state.rootPath || state.activeType !== "note" || !state.activePath || !state.mention.active) return;

  const sourcePath = state.activePath;
  const rangeStart = state.mention.start;
  const rangeEnd = els.editor.selectionStart;
  const defaultName = mentionDefaultName();
  closeMentionMenu();
  const requestedName = await openNameDialog({
    title: "New node",
    defaultName
  });
  if (requestedName === null) {
    els.editor.focus();
    return;
  }

  try {
    const newPath = await globalThis.tektite.createNote(state.rootPath, requestedName, parentFolder(sourcePath));
    await refreshVault();
    if (state.activePath !== sourcePath && entryExists(sourcePath, "note")) {
      await openNote(sourcePath);
    }

    const note = state.noteByPath.get(newPath);
    if (!note) throw new Error("Created note was not found after refresh.");
    const link = `[${note.name}](${relativeMarkdownLink(sourcePath, newPath)})`;
    els.editor.setRangeText(link, rangeStart, rangeEnd, "end");
    state.activeContent = els.editor.value;
    renderPreview(state.activeContent);
    recordEditorHistory();
    setSaveState("Unsaved");
    clearTimeout(state.saveTimer);
    await saveActiveNote();
    await openNote(newPath);
  } catch (error) {
    console.error("[tektite:renderer] createMentionNode failed", error);
    setSaveState("Failed");
  }
}

function mentionDefaultName() {
  return state.mention.query.trim() || "Untitled";
}

function onEditorDragOver(event) {
  if (!state.rootPath || state.activeType !== "note" || !state.activePath) return;
  const hasInternalEntry = event.dataTransfer.types.includes("application/x-tektite-entry");
  if (!hasInternalEntry && !hasImageFiles(event.dataTransfer.files)) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = "copy";
}

async function onEditorDrop(event) {
  if (!state.rootPath || state.activeType !== "note" || !state.activePath) return;
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
      const sourcePath = globalThis.tektite.getFilePath(file);
      if (!sourcePath) continue;
      imported.push(await globalThis.tektite.importImage(state.rootPath, sourcePath, activeFolder()));
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
      const sourcePath = globalThis.tektite.getFilePath(file);
      if (!sourcePath) continue;
      await globalThis.tektite.importImage(state.rootPath, sourcePath, targetFolderPath);
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
    if (!canMoveTreeEntry(payload, targetFolderPath)) return;
    const originalActivePath = state.activePath;
    const nextPath = await globalThis.tektite.moveEntry(state.rootPath, payload.path, payload.type, targetFolderPath);
    updateMovedEntryState(payload, nextPath, originalActivePath);
    state.collapsedFolders.delete(targetFolderPath);
    await refreshVault();
    await reopenMovedTreeEntry(payload, nextPath);
    setSaveState("Moved");
  } catch (error) {
    console.error("[tektite:renderer] moveTreeEntry failed", error);
    setSaveState("Failed");
  }
}

function canMoveTreeEntry(payload, targetFolderPath) {
  if (!payload.path || payload.path === targetFolderPath) return false;
  return payload.type !== "folder" || !targetFolderPath.startsWith(`${payload.path}/`);
}

function updateMovedEntryState(payload, nextPath, originalActivePath) {
  if (payload.path === originalActivePath) {
    state.activePath = nextPath;
  } else if (payload.type === "folder" && isPathInside(originalActivePath, payload.path)) {
    state.activePath = `${nextPath}${originalActivePath.slice(payload.path.length)}`;
  }

  if (state.selectedPath !== payload.path) return;
  state.selectedPath = payload.type === "folder" ? "" : nextPath;
  state.selectedType = payload.type === "folder" ? "folder" : payload.type;
}

async function reopenMovedTreeEntry(payload, nextPath) {
  if (state.activePath) {
    await openMovedActiveEntry(state.activePath);
    if (entryExists(state.activePath, state.activeType)) return;
  }
  if (payload.type === "note") {
    await openNote(nextPath);
    return;
  }
  if (payload.type === "asset") await openAsset(nextPath);
}

function pathAfterMove(originalPath, oldBasePath, newBasePath) {
  if (!originalPath || !oldBasePath || originalPath === oldBasePath) return newBasePath;
  if (!originalPath.startsWith(`${oldBasePath}/`)) return originalPath;
  return `${newBasePath}${originalPath.slice(oldBasePath.length)}`;
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
  return encodeURI(normalized).replaceAll("%5B", "[").replaceAll("%5D", "]");
}

function localImageUrl(target, sourcePath = "") {
  const decoded = decodeLink(target);
  if (/^[a-z]+:\/\//i.test(decoded)) return null;
  const clean = decoded.replace(/#.*$/u, "").trim();
  const extension = clean.split(".").pop()?.toLowerCase();
  if (!["png", "jpg", "jpeg", "gif", "webp", "svg", "avif"].includes(extension)) return null;

  const sourceFolder = parentFolder(sourcePath);
  const relative = normalizeVaultPath(sourceFolder ? `${sourceFolder}/${clean}` : clean);
  if (!relative || !state.rootPath) return null;
  const absolutePath = `${state.rootPath}/${relative}`;
  return `file://${encodeURI(absolutePath)}`;
}

function relativePath(fromFolder, toPath) {
  const fromParts = fromFolder ? fromFolder.split("/") : [];
  const toParts = toPath.split("/");
  while (fromParts.length && toParts.length && fromParts[0] === toParts[0]) {
    fromParts.shift();
    toParts.shift();
  }
  return [...fromParts.map(() => ".."), ...toParts].join("/") || `./${toPath.split("/").at(-1)}`;
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
  div.style.overflowWrap = "break-word";
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
    height: Number.parseFloat(style.lineHeight) || 20
  };

  div.remove();
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

  return null;
}

async function openNote(relativePath, options = {}) {
  log("openNote", relativePath);
  if (!state.rootPath || !state.noteByPath.has(relativePath)) return;
  ensureOpenTab(relativePath, "note");
  await activateTab(relativePath, "note", options);
}

async function openAsset(relativePath, options = {}) {
  log("openAsset", relativePath);
  if (!state.rootPath || !isImagePath(relativePath) || !treeEntryExists(state.tree, relativePath, "asset")) return;
  ensureOpenTab(relativePath, "asset");
  await activateTab(relativePath, "asset", options);
}

async function activateTab(relativePath, type, options = {}) {
  if (!state.rootPath || !entryExists(relativePath, type)) return;
  if (state.activePath !== relativePath || state.activeType !== type) {
    await flushActiveNote();
  }
  if (!options.preservePreviewHistory) {
    state.previewHistory = [];
    state.previewForwardHistory = [];
  }

  state.activePath = relativePath;
  state.activeType = type;
  state.selectedPath = relativePath;
  state.selectedType = type;
  els.notePath.textContent = relativePath;

  if (type === "note") {
    const cursor = options.preserveCursor ? els.editor.selectionStart : 0;
    const content = state.noteContent.has(relativePath)
      ? state.noteContent.get(relativePath)
      : await globalThis.tektite.readNote(state.rootPath, relativePath);

    state.activeContent = content;
    state.noteContent.set(relativePath, content);
    els.editor.disabled = false;
    els.editor.classList.remove("hidden");
    els.imageViewer.classList.add("hidden");
    els.imageViewerImage.removeAttribute("src");
    els.editor.value = content;
    els.noteTitle.textContent = state.noteByPath.get(relativePath).title;
    els.editor.setSelectionRange(Math.min(cursor, content.length), Math.min(cursor, content.length));
    resetEditorHistory(content, Math.min(cursor, content.length));
    renderPreview(content);
    els.editor.focus();
  } else {
    state.activeContent = "";
    els.editor.disabled = true;
    els.editor.classList.add("hidden");
    els.imageViewer.classList.remove("hidden");
    const dataUrl = await globalThis.tektite.readAssetDataUrl(state.rootPath, relativePath);
    els.imageViewerImage.src = dataUrl;
    els.imageViewerImage.alt = relativePath.split("/").pop() || relativePath;
    els.noteTitle.textContent = relativePath.split("/").pop() || relativePath;
    resetEditorHistory("", 0);
    els.preview.innerHTML = `<p class="empty-copy">${escapeHtml(relativePath)}</p><img src="${dataUrl}" alt="${escapeAttr(els.imageViewerImage.alt)}">`;
  }

  renderEditorTabs();
  renderTree();
  updatePreviewNavButtons();
  updateGraph();
  setSaveState(type === "note" ? "Saved" : "Read-only");
  saveWorkspaceState();
}

function ensureOpenTab(path, type) {
  const key = tabKey(path, type);
  if (state.openTabs.some((tab) => tab.key === key)) return;
  state.openTabs.push({
    key,
    path,
    type,
    title: tabTitle(path, type)
  });
}

function reconcileOpenTabs() {
  state.openTabs = state.openTabs
    .filter((tab) => entryExists(tab.path, tab.type))
    .map((tab) => ({ ...tab, title: tabTitle(tab.path, tab.type) }));

  if (state.activePath && !entryExists(state.activePath, state.activeType)) {
    state.activePath = null;
    state.activeType = null;
    state.activeContent = "";
  }
}

function renderEditorTabs() {
  els.editorTabs.innerHTML = "";
  els.editorTabs.hidden = state.openTabs.length === 0;

  for (const tab of state.openTabs) {
    const button = document.createElement("button");
    button.className = `editor-tab${tab.path === state.activePath && tab.type === state.activeType ? " active" : ""}`;
    button.type = "button";
    button.setAttribute("role", "tab");
    button.setAttribute("aria-selected", tab.path === state.activePath && tab.type === state.activeType ? "true" : "false");
    button.title = tab.path;
    button.innerHTML = `
      ${treeIconSvg(tab.type)}
      <span class="editor-tab-label">${escapeHtml(tab.title)}</span>
      <span class="editor-tab-close" role="button" aria-label="Close tab" tabindex="-1">×</span>
    `;
    button.addEventListener("click", (event) => {
      if (event.target.closest(".editor-tab-close")) {
        closeEditorTab(tab.path, tab.type);
        return;
      }
      activateTab(tab.path, tab.type);
    });
    els.editorTabs.appendChild(button);
  }
}

async function closeEditorTab(path, type) {
  const closingActive = path === state.activePath && type === state.activeType;
  if (closingActive) await flushActiveNote();

  const index = state.openTabs.findIndex((tab) => tab.path === path && tab.type === type);
  if (index < 0) return;
  state.openTabs.splice(index, 1);

  if (!closingActive) {
    renderEditorTabs();
    saveWorkspaceState();
    return;
  }

  const nextIndex = Math.min(index, state.openTabs.length - 1);
  const nextTab = nextIndex === -1 ? undefined : state.openTabs[nextIndex];
  if (nextTab) {
    await activateTab(nextTab.path, nextTab.type);
  } else {
    showEmptyState("Select or create a note.");
  }
  saveWorkspaceState();
}

function closeActiveEditorTab() {
  if (!state.activePath || !state.activeType) return;
  closeEditorTab(state.activePath, state.activeType);
}

async function flushActiveNote() {
  if (state.activeType !== "note" || !state.activePath) return;
  state.activeContent = els.editor.value;
  state.noteContent.set(state.activePath, state.activeContent);
  clearTimeout(state.saveTimer);
  await saveActiveNote();
}

function tabKey(path, type) {
  return `${type}:${path}`;
}

function tabTitle(path, type) {
  if (type === "note" && state.noteByPath.has(path)) {
    const note = state.noteByPath.get(path);
    return state.showFileExtensions ? note.name : note.title;
  }
  return path.split("/").pop() || path;
}

function onEditorInput() {
  if (state.activeType !== "note") return;
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
  if (state.activeType !== "note" || !state.activePath || state.editorHistory.restoring) return;
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
  if (state.activeType !== "note" || !state.activePath || state.editorHistory.path !== state.activePath) return;
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
    state.mention.selectedIndex = Math.min(state.mention.selectedIndex + 1, state.mention.items.length);
    renderMentionMenu();
  } else if (event.key === "ArrowUp") {
    event.preventDefault();
    state.mention.selectedIndex = Math.max(state.mention.selectedIndex - 1, 0);
    renderMentionMenu();
  } else if (event.key === "Enter" || event.key === "Tab") {
    event.preventDefault();
    if (state.mention.selectedIndex === 0) createMentionNode();
    else insertMentionLink(state.mention.items[state.mention.selectedIndex - 1]);
  } else if (event.key === "Escape") {
    event.preventDefault();
    closeMentionMenu();
  }
}

async function saveActiveNote() {
  if (!state.rootPath || state.activeType !== "note" || !state.activePath) return;
  state.activeContent = els.editor.value;
  setSaveState("Saving...");
  await globalThis.tektite.writeNote(state.rootPath, state.activePath, state.activeContent);
  state.noteContent.set(state.activePath, state.activeContent);
  setSaveState("Saved");
  const vault = await globalThis.tektite.scanVault(state.rootPath);
  state.tree = vault.tree;
  state.notes = vault.notes;
  indexNotes();
  reconcileOpenTabs();
  renderEditorTabs();
  renderTree();
  updateGraph();
}

function showEmptyState(message = "Choose a local folder to start.") {
  state.activePath = null;
  state.activeType = null;
  state.activeContent = "";
  state.openTabs = [];
  state.previewHistory = [];
  state.previewForwardHistory = [];
  state.hasGitRepo = false;
  state.gitProvider = null;
  els.editor.value = "";
  els.editor.disabled = true;
  els.editor.classList.remove("hidden");
  els.imageViewer.classList.add("hidden");
  els.imageViewerImage.removeAttribute("src");
  resetEditorHistory("", 0);
  els.noteTitle.textContent = "Open a vault";
  els.notePath.textContent = message;
  els.preview.innerHTML = `<p class="empty-copy">${escapeHtml(message)}</p>`;
  renderEditorTabs();
  updateGitSyncButton();
  updatePreviewNavButtons();
  updateGraph();
  saveWorkspaceState();
}

function showGitOutputDialog(output) {
  els.gitOutputText.textContent = output;
  setGitOutputCloseState(state.gitSyncInProgress);
  els.gitOutputDialog.setAttribute("open", "");
  els.gitOutputDialog.classList.remove("hidden");
}

function setGitOutputCloseState(syncing) {
  els.closeGitOutputButton.disabled = syncing;
  els.closeGitOutputButton.textContent = syncing ? "Syncing..." : "Close";
  els.closeGitOutputXButton.disabled = syncing;
}

function appendGitOutput(text) {
  els.gitOutputText.textContent += text;
  els.gitOutputText.scrollTop = els.gitOutputText.scrollHeight;
}

function onGitSyncOutput(payload) {
  if (!payload || typeof payload !== "object") return;
  if (typeof payload.text === "string") appendGitOutput(payload.text);
}

function clearGitOutputSubscription() {
  if (!state.gitOutputUnsubscribe) return;
  state.gitOutputUnsubscribe();
  state.gitOutputUnsubscribe = null;
}

function closeGitOutputDialog() {
  els.gitOutputDialog.classList.add("hidden");
  els.gitOutputDialog.removeAttribute("open");
}

async function restoreWorkspaceState() {
  const workspace = await loadWorkspaceState();
  if (!workspace) return false;

  const tabs = sanitizeSavedTabs(workspace.openTabs);
  if (tabs.length === 0) return false;

  state.openTabs = tabs.map((tab) => ({
    key: tabKey(tab.path, tab.type),
    path: tab.path,
    type: tab.type,
    title: tabTitle(tab.path, tab.type)
  }));

  const active = tabs.find((tab) => tab.path === workspace.activePath && tab.type === workspace.activeType) || tabs[0];
  await activateTab(active.path, active.type, { preserveCursor: true });
  return true;
}

async function loadWorkspaceState() {
  if (!state.rootPath) return null;
  try {
    const persisted = await globalThis.tektite.loadWorkspaceState(state.rootPath);
    if (persisted?.workspace && typeof persisted.workspace === "object") return persisted.workspace;
  } catch (error) {
    console.warn("[tektite:renderer] workspace state load failed", error);
  }

  try {
    const workspace = JSON.parse(localStorage.getItem(workspaceStorageKey()) || "null");
    if (!workspace || typeof workspace !== "object") return null;
    return workspace;
  } catch {
    return null;
  }
}

function sanitizeSavedTabs(tabs) {
  if (!Array.isArray(tabs)) return [];

  const seen = new Set();
  return tabs
    .filter((tab) => tab && typeof tab.path === "string" && (tab.type === "note" || tab.type === "asset"))
    .filter((tab) => entryExists(tab.path, tab.type))
    .filter((tab) => {
      const key = tabKey(tab.path, tab.type);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function saveWorkspaceState() {
  if (!state.rootPath) return;

  const tabs = state.openTabs
    .filter((tab) => entryExists(tab.path, tab.type))
    .map((tab) => ({ path: tab.path, type: tab.type }));

  const workspace = {
    openTabs: tabs,
    activePath: state.activePath,
    activeType: state.activeType,
    selectedPath: state.selectedPath,
    selectedType: state.selectedType
  };

  localStorage.setItem(workspaceStorageKey(), JSON.stringify(workspace));
  globalThis.tektite.saveWorkspaceState(state.rootPath, workspace).catch((error) => {
    console.warn("[tektite:renderer] workspace state save failed", error);
  });
}

function workspaceStorageKey() {
  return `${WORKSPACE_STORAGE_PREFIX}${state.rootPath}`;
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
        nextContent.set(note.path, await globalThis.tektite.readNote(state.rootPath, note.path));
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
  button.className = "tree-row vault-root-row";
  button.type = "button";
  button.dataset.path = "";
  button.dataset.type = "folder";
  button.innerHTML = `${treeIconSvg("folder")}<span class="tree-label">${escapeHtml(state.tree.name || "Vault")}</span>`;
  button.addEventListener("click", () => toggleFolder(""));
  return button;
}

function treeIconSvg(kind) {
  if (kind === "note") {
    return `<span class="tree-kind-icon" aria-hidden="true"><svg viewBox="0 0 48 48"><path d="M39.5 15.5h-9a2 2 0 0 1-2-2v-9h-18a2 2 0 0 0-2 2v35a2 2 0 0 0 2 2h27a2 2 0 0 0 2-2Z"></path><path d="M28.5 4.5 39.5 15.5"></path></svg></span>`;
  }
  if (kind === "asset") {
    return `<span class="tree-kind-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="14" rx="2"></rect><path d="m8 15 2.2-2.2a1.2 1.2 0 0 1 1.7 0L15 16"></path><path d="m14 14 1-1a1.2 1.2 0 0 1 1.7 0L20 16.3"></path><path d="M8.5 9.5h.01"></path></svg></span>`;
  }
  return `<span class="tree-kind-icon tree-folder-icon" aria-hidden="true"><svg viewBox="0 0 32 32"><path d="M28 11v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6c3 0 3 3 5 3h9a2 2 0 0 1 2 2z"></path></svg></span>`;
}

function renderTreeNode(node, query) {
  if (node.type === "note" || node.type === "asset") return renderTreeLeafNode(node, query);
  return renderTreeFolderNode(node, query);
}

function renderTreeLeafNode(node, query) {
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
  button.innerHTML = `${treeIconSvg(node.type)}<span class="tree-label">${escapeHtml(label)}</span>`;
  button.addEventListener("click", () => {
    if (node.type === "note") openNote(node.path);
    else openAsset(node.path);
  });
  return button;
}

function renderTreeFolderNode(node, query) {
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

  const toggle = document.createElement("button");
  toggle.className = "tree-caret-button";
  toggle.type = "button";
  toggle.setAttribute("aria-label", isCollapsed ? "Expand folder" : "Collapse folder");
  toggle.innerHTML = `<span class="tree-caret" aria-hidden="true">${isCollapsed ? "▸" : "▾"}</span>`;
  toggle.addEventListener("click", () => toggleFolder(node.path));

  const label = document.createElement("button");
  label.className = "tree-label-button";
  label.type = "button";
  label.innerHTML = `${treeIconSvg("folder")}<span class="tree-label">${escapeHtml(node.name)}</span>`;
  label.addEventListener("click", () => toggleFolder(node.path));

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
  if (context.type !== "folder") selectEntry(context.path, context.type);
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
    items.push(
      { type: "separator" },
      {
        label: context.type === "folder" ? "Rename folder" : "Rename file",
        action: () => renameSelectedEntry(context)
      },
      {
        label: context.type === "folder" ? "Delete folder" : "Delete file",
        danger: true,
        action: () => deleteSelectedEntry(context)
      }
    );
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
  els.treeContextMenu.style.left = `${Math.min(x, globalThis.innerWidth - rect.width - 8)}px`;
  els.treeContextMenu.style.top = `${Math.min(y, globalThis.innerHeight - rect.height - 8)}px`;
}

function closeTreeContextMenu() {
  els.treeContextMenu.classList.add("hidden");
}

function toggleFolder(folderPath) {
  if (!folderPath) return;
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
  const context = {
    sourcePath,
    blocks: [],
    paragraph: [],
    list: [],
    inCode: false,
    code: []
  };

  for (const line of markdown.replaceAll("\r\n", "\n").split("\n")) {
    processMarkdownLine(context, line);
  }

  flushMarkdownParagraph(context);
  flushMarkdownList(context);
  if (context.inCode) flushMarkdownCode(context, true);
  return context.blocks.join("\n") || "<p>Start writing.</p>";
}

function processMarkdownLine(context, line) {
  if (line.startsWith("```")) return toggleMarkdownCode(context);
  if (context.inCode) {
    context.code.push(line);
    return;
  }
  if (!line.trim()) return flushMarkdownBlocks(context);

  const heading = line.match(/^(#{1,6})\s+(.+)$/);
  if (heading) return appendMarkdownHeading(context, heading);
  if (/^---+$/.test(line.trim())) return appendMarkdownRule(context);

  const listItem = line.match(/^\s*[-*+]\s+(.+)$/);
  if (listItem) {
    flushMarkdownParagraph(context);
    context.list.push(listItem[1]);
    return;
  }

  const quote = line.match(/^>\s?(.*)$/);
  if (quote) return appendMarkdownQuote(context, quote[1]);
  context.paragraph.push(line.trim());
}

function toggleMarkdownCode(context) {
  if (context.inCode) {
    flushMarkdownCode(context, true);
    context.inCode = false;
    return;
  }
  flushMarkdownBlocks(context);
  context.inCode = true;
}

function flushMarkdownBlocks(context) {
  flushMarkdownParagraph(context);
  flushMarkdownList(context);
}

function flushMarkdownParagraph(context) {
  if (!context.paragraph.length) return;
  context.blocks.push(`<p>${inlineMarkdown(context.paragraph.join(" "), context.sourcePath)}</p>`);
  context.paragraph = [];
}

function flushMarkdownList(context) {
  if (!context.list.length) return;
  const items = context.list
    .map((item) => `<li>${inlineMarkdown(item, context.sourcePath)}</li>`)
    .join("");
  context.blocks.push(`<ul>${items}</ul>`);
  context.list = [];
}

function flushMarkdownCode(context, force = false) {
  if (!force && !context.code.length) return;
  context.blocks.push(`<pre><code>${escapeHtml(context.code.join("\n"))}</code></pre>`);
  context.code = [];
}

function appendMarkdownHeading(context, heading) {
  flushMarkdownBlocks(context);
  const level = heading[1].length;
  const content = inlineMarkdown(heading[2], context.sourcePath);
  context.blocks.push(`<h${level}>${content}</h${level}>`);
}

function appendMarkdownRule(context) {
  flushMarkdownBlocks(context);
  context.blocks.push("<hr>");
}

function appendMarkdownQuote(context, quote) {
  flushMarkdownBlocks(context);
  context.blocks.push(`<blockquote>${inlineMarkdown(quote, context.sourcePath)}</blockquote>`);
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
    const linkLabel = restore(tokens, label);
    if (note) {
      return stash(tokens, `<a href="#" data-note-path="${escapeAttr(note.path)}">${linkLabel}</a>`);
    }
    if (/^https?:\/\//i.test(decoded)) {
      return stash(tokens, `<a href="${escapeAttr(decoded)}" target="_blank" rel="noreferrer">${linkLabel}</a>`);
    }
    return stash(tokens, `<span class="wiki-link missing">${linkLabel}</span>`);
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
  return normalizeVaultPath(target.replaceAll("\\", "/").replace(/^\.\/+/, ""));
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

  const wikiTargets = [];
  const markdownTargets = [];
  while ((match = wiki.exec(markdown))) wikiTargets.push(match[1]);
  while ((match = md.exec(markdown))) markdownTargets.push(match[1]);
  targets.push(...wikiTargets, ...markdownTargets);
  return targets;
}

function drawGraph({ nodes, edges }) {
  const svg = els.graphSvg;
  const colors = graphColors();
  const rect = svg.getBoundingClientRect();
  const width = Math.max(rect.width || 720, 480);
  const height = Math.max(rect.height || 520, 420);
  const world = graphWorldSize(nodes.length, width, height);
  const signature = graphLayoutSignature(nodes, edges);
  if (signature !== state.graphLayoutSignature) {
    state.graphPositions.clear();
    state.graphLayoutSignature = signature;
    fitGraphViewport(world.width, world.height, width, height);
  }

  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.innerHTML = "";
  els.graphEmpty.classList.toggle("hidden", nodes.length > 0 && edges.length > 0);

  if (!nodes.length) return;

  layoutGraphNodes(nodes, edges, world.width, world.height);
  renderGraphSvg(svg, nodes, edges, colors);
}

function graphColors() {
  const theme = getComputedStyle(document.documentElement);
  return {
    edge: theme.getPropertyValue("--graph-edge").trim() || "#557b7f",
    node: theme.getPropertyValue("--graph-node").trim() || "#25272d",
    accent: theme.getPropertyValue("--accent").trim() || "#65a8ad",
    accentDark: theme.getPropertyValue("--accent-dark").trim() || "#7fb9bd",
    ink: theme.getPropertyValue("--ink").trim() || "#ece6da"
  };
}

function graphLayoutSignature(nodes, edges) {
  const nodeIds = nodes.map((node) => node.id).sort().join("|");
  const edgeIds = edges
    .map((edge) => `${edge.source}->${edge.target}`)
    .sort()
    .join("|");
  return `${nodeIds}::${edgeIds}`;
}

function graphWorldSize(nodeCount, width, height) {
  const density = Math.max(1, Math.sqrt(nodeCount));
  return {
    width: Math.max(width, Math.round(density * 220)),
    height: Math.max(height, Math.round(density * 170))
  };
}

function fitGraphViewport(worldWidth, worldHeight, width, height) {
  const scale = clamp(Math.min(width / worldWidth, height / worldHeight) * 0.92, 0.28, 1);
  state.graphViewport.scale = scale;
  state.graphViewport.x = Math.round((width - worldWidth * scale) / 2);
  state.graphViewport.y = Math.round((height - worldHeight * scale) / 2);
}

function layoutGraphNodes(nodes, edges, width, height) {
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.min(width, height) * 0.42;
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
  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  const ticks = hasSavedLayout ? 80 : graphLayoutTicks(nodes.length);
  for (let tick = 0; tick < ticks; tick += 1) {
    applyGraphRepulsion(nodes);
    applyGraphEdgeAttraction(edges, nodeMap);
    applyGraphCollision(nodes);
    pullGraphNodesToCenter(nodes, centerX, centerY, width, height);
  }

  nodes.forEach((node) => {
    state.graphPositions.set(node.id, { x: node.x, y: node.y });
  });
}

function graphLayoutTicks(nodeCount) {
  return clamp(220 + nodeCount * 8, 260, 900);
}

function applyGraphRepulsion(nodes) {
  for (let i = 0; i < nodes.length; i += 1) {
    for (let j = i + 1; j < nodes.length; j += 1) {
      pushGraphNodesApart(nodes[i], nodes[j]);
    }
  }
}

function pushGraphNodesApart(a, b) {
  const dx = a.x - b.x || 0.01;
  const dy = a.y - b.y || 0.01;
  const distance = Math.hypot(dx, dy);
  const force = Math.min(5200 / (distance * distance), 8);
  a.x += (dx / distance) * force;
  a.y += (dy / distance) * force;
  b.x -= (dx / distance) * force;
  b.y -= (dy / distance) * force;
}

function applyGraphCollision(nodes) {
  for (let i = 0; i < nodes.length; i += 1) {
    for (let j = i + 1; j < nodes.length; j += 1) {
      separateGraphNodes(nodes[i], nodes[j]);
    }
  }
}

function separateGraphNodes(a, b) {
  const dx = b.x - a.x || 0.01;
  const dy = b.y - a.y || 0.01;
  const distance = Math.hypot(dx, dy);
  const minDistance = graphNodeCollisionRadius(a) + graphNodeCollisionRadius(b);
  if (distance >= minDistance) return;

  const push = (minDistance - distance) * 0.56;
  const nx = dx / distance;
  const ny = dy / distance;
  a.x -= nx * push;
  a.y -= ny * push;
  b.x += nx * push;
  b.y += ny * push;
}

function graphNodeCollisionRadius(node) {
  const labelWidth = Math.min(180, Math.max(48, node.title.length * 7));
  return graphNodeRadius(node) + labelWidth * 0.24 + 18;
}

function applyGraphEdgeAttraction(edges, nodeMap) {
  for (const edge of edges) {
    const source = nodeMap.get(edge.source);
    const target = nodeMap.get(edge.target);
    if (!source || !target) continue;
    const dx = target.x - source.x;
    const dy = target.y - source.y;
    source.x += dx * 0.0035;
    source.y += dy * 0.0035;
    target.x -= dx * 0.0035;
    target.y -= dy * 0.0035;
  }
}

function pullGraphNodesToCenter(nodes, centerX, centerY, width, height) {
  for (const node of nodes) {
    node.x += (centerX - node.x) * 0.0035;
    node.y += (centerY - node.y) * 0.0035;
    const margin = graphNodeCollisionRadius(node);
    node.x = clamp(node.x, margin, width - margin);
    node.y = clamp(node.y, margin, height - margin);
  }
}

function renderGraphSvg(svg, nodes, edges, colors) {
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
    line.setAttribute("stroke", colors.edge);
    line.setAttribute("stroke-width", "1.4");
    line.dataset.source = edge.source;
    line.dataset.target = edge.target;
    edgeLayer.appendChild(line);
  }

  for (const node of nodes) {
    const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
    group.dataset.notePath = node.id;
    group.setAttribute("class", "graph-node");
    group.style.cursor = "pointer";

    const nodeRadius = graphNodeRadius(node);
    const labelOffset = nodeRadius + 8;
    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("cx", node.x);
    circle.setAttribute("cy", node.y);
    circle.setAttribute("r", nodeRadius);
    circle.setAttribute("fill", node.active ? colors.accent : colors.node);
    circle.setAttribute("stroke", node.active ? colors.accentDark : colors.accent);
    circle.setAttribute("stroke-width", node.active ? "3" : "2");

    const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
    label.setAttribute("x", node.x + labelOffset);
    label.setAttribute("y", node.y + 4);
    label.dataset.offsetX = String(labelOffset);
    label.setAttribute("fill", colors.ink);
    label.setAttribute("font-size", "12");
    label.setAttribute("font-weight", node.active ? "700" : "560");
    label.textContent = node.title;

    group.append(circle, label);
    nodeLayer.appendChild(group);
  }

  viewportLayer.append(edgeLayer, nodeLayer);
  svg.append(viewportLayer);
}

function graphNodeRadius(node) {
  return 8 + Math.min(node.degree, 8) * 1.6;
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
  globalThis.addEventListener("pointermove", onGraphPointerMove);
  globalThis.addEventListener("pointerup", stopGraphPan, { once: true });
  globalThis.addEventListener("pointercancel", stopGraphPan, { once: true });
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
  els.graphSvg.classList.remove("panning", "dragging-node");
  globalThis.removeEventListener("pointermove", onGraphPointerMove);
  globalThis.removeEventListener("pointercancel", stopGraphPan);
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
  if (label) {
    const offsetX = Number(label.dataset.offsetX) || 13;
    label.setAttribute("x", x + offsetX);
    label.setAttribute("y", y + 4);
  }

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
  if (state.activePath && state.activeType === "note") {
    const lastPath = state.previewHistory.at(-1);
    if (lastPath !== state.activePath) state.previewHistory.push(state.activePath);
  }
  state.previewForwardHistory = [];
  openNote(notePath, { preservePreviewHistory: true });
}

function goBackPreviewHistory() {
  const previousPath = state.previewHistory.pop();
  if (!previousPath) return updatePreviewNavButtons();
  if (state.activePath && state.activeType === "note") state.previewForwardHistory.push(state.activePath);
  openNote(previousPath, { preservePreviewHistory: true });
}

function goForwardPreviewHistory() {
  const nextPath = state.previewForwardHistory.pop();
  if (!nextPath) return updatePreviewNavButtons();
  if (state.activePath && state.activeType === "note") state.previewHistory.push(state.activePath);
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
  if (!context?.path) return "";
  if (context.type === "folder") return context.path;
  return parentFolder(context.path);
}

function currentSelection() {
  if (state.selectedPath) {
    return { path: state.selectedPath, type: state.selectedType };
  }
  if (state.activePath) {
    return { path: state.activePath, type: state.activeType || "note" };
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
  if (node?.type !== "folder") return false;
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
  const token = `@@TEKTITE_STASH_${tokens.length}@@`;
  tokens.push(html);
  return token;
}

function restore(tokens, text) {
  return text.replace(/@@TEKTITE_STASH_(\d+)@@/g, (_match, index) => tokens[Number(index)]);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value).replaceAll("`", "&#096;");
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function cssEscape(value) {
  if (globalThis.CSS?.escape) return globalThis.CSS.escape(value);
  const backslash = String.fromCodePoint(92);
  const quote = String.fromCodePoint(34);
  return String(value)
    .replaceAll(backslash, backslash + backslash)
    .replaceAll(quote, backslash + quote);
}
