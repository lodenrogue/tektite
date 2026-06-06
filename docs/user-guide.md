# Tektite User Guide

Tektite is a lightweight Markdown knowledge base for macOS and Linux. It works entirely on local folders — no accounts, no cloud, no telemetry.

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Vaults](#vaults)
3. [File Tree](#file-tree)
4. [Editor](#editor)
5. [Preview](#preview)
6. [Tags Pane](#tags-pane)
7. [Graph Pane](#graph-pane)
8. [Git Sync](#git-sync)
9. [Templates](#templates)
10. [Settings](#settings)
11. [Terminal](#terminal)
12. [Layout & Appearance](#layout--appearance)
13. [Keyboard Shortcuts](#keyboard-shortcuts)

---

## Getting Started

When Tektite launches it reopens the last vault you had open. If no vault has been opened before, you see an empty state with an **Open Vault** button.

A vault is any folder on your disk. Tektite does not create or manage a special database — it reads the folder directly.

---

## Vaults

### Opening a vault

Click **Open Vault** in the toolbar, or use **File › Open Vault…** (`Cmd+O`). A system folder picker appears. Select any folder and Tektite scans it for Markdown notes and images.

### Recent vaults

**File › Recent Vaults…** lists the last ten folders you opened. Clicking one reopens it immediately without a folder picker.

### Refreshing a vault

If you add, remove, or rename files outside Tektite (e.g. in Finder or a terminal), click the **Refresh** button in the toolbar or press `Cmd+R` to rescan the vault and update the file tree.

### What Tektite shows

Tektite shows:
- Markdown files (`.md`) — as notes
- Image files (`.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.svg`, `.avif`) — as assets
- Folders — as collapsible tree nodes

Files and folders whose names start with `.`, and `node_modules` directories, are hidden.

---

## File Tree

The left sidebar contains the file tree, search bar, tags pane, and graph pane.

### Browsing

Click a note to open it. Click a folder name to collapse or expand it.

### Search

Type in the search bar above the file tree to filter by filename, path, or Markdown content. The filter applies live as you type.

### Context menu

Right-click any entry in the file tree (or use the `…` button that appears on hover) to access:

- **New Note** — create a new `.md` file inside the selected folder
- **New Folder** — create a subfolder inside the selected folder
- **Rename** — rename the file or folder
- **Delete** — permanently delete the file or folder (and all contents, for folders)

### Drag and drop in the file tree

Drag any note, folder, or image to a different location in the file tree to move it. Tektite automatically updates all Markdown image links that reference a moved image.

### Importing images

Drag an image file from Finder (or your desktop) onto the file tree to import it into your vault. The image is copied into the folder where you drop it.

### Showing file extensions

By default, `.md` extensions are hidden to keep filenames clean. Click the **suffix toggle** button in the toolbar (shows `.md` or `abc`) to show or hide extensions for all entries.

---

## Editor

### Writing notes

Click a note in the file tree to open it in the editor. The editor is a plain-text textarea. Markdown is rendered live in the preview pane to the right.

### Autosave

Changes are saved automatically after a short pause after you stop typing. The save state indicator in the toolbar shows **Saving…** while a write is pending and **Saved** once the file is written to disk.

### Multiple tabs

Open multiple notes using tabs at the top of the editor. Each tab shows the note title (or filename). Close a tab with `Cmd+W`. Close all tabs with **File › Close All Tabs**.

### Undo and redo

The editor supports native undo and redo (`Cmd+Z` / `Cmd+Shift+Z`). History is per-note and scoped to the current session.

### Linking to another note with `@`

Type `@` anywhere in the editor body to open an autocomplete menu of notes in the vault. Start typing to filter by note title. Press `Enter` or click a suggestion to insert a Markdown link to that note.

### Wikilinks

You can write links in `[[wikilink]]` syntax. Wikilinks are resolved when you click them in the preview pane.

### Inserting links and images by drag and drop

Drag a note or folder from the file tree into the editor to insert a Markdown link to it. Drag an image asset from the file tree into the editor to insert a Markdown image embed (`![](path)`). Drag an image file from Finder into the editor to import it into the vault and embed it in one step.

### Viewing images

Click an image asset in the file tree to open it in the image viewer instead of the editor.

---

## Preview

The right pane shows a live rendered preview of the active note. It updates as you type.

### Following links

Click any Markdown link or `[[wikilink]]` in the preview to open the linked note. The editor and preview both switch to the new note.

### Back and forward navigation

After following a preview link, the **back arrow** in the preview toolbar returns to the previous note. The **forward arrow** moves forward again if you went back.

---

## Tags Pane

Tektite collects `#hashtags` from the body of all Markdown notes in the vault and displays them as a tag cloud in the left sidebar.

### Filtering by tag

Click any tag in the tag cloud to filter the file tree to show only notes that contain that tag. Click the tag again or clear the search to remove the filter.

### Showing and hiding the Tags pane

Use **View › Show/Hide Tags Pane** to show or hide the Tags pane. The preference is saved.

### Collapsing the Tags pane

Click the **`-`** button in the Tags pane header to collapse it to a slim header bar. Click **`+`** to expand it again. This saves vertical space without fully hiding the pane.

### Resizing the Tags pane

Drag the horizontal divider between the Tags pane and the Graph pane to resize them.

---

## Graph Pane

The Graph pane renders a visual map of connections between notes based on their Markdown links and wikilinks.

Each note is a node. A directed edge connects one note to another if the first note contains a link to the second.

### Navigating the graph

- **Click a node** to open that note.
- **Scroll** over the graph to zoom in or out.
- **Drag empty space** to pan the viewport.
- **Drag a node** to reposition it. Node positions are remembered per vault across sessions.

### Showing and hiding the Graph pane

Use **View › Show/Hide Graph Pane**. The preference is saved.

### Collapsing the Graph pane

Click the **`-`** button in the Graph pane header to collapse it to a slim header bar.

---

## Git Sync

Tektite has a one-click Git sync feature for vaults that are Git repositories. It runs a pull-commit-push cycle to keep your vault in sync with a remote.

### When the sync button appears

The sync button only appears in the toolbar when the open vault contains a `.git` directory. Tektite detects this when scanning the vault. If the folder is not a Git repository, the button is not shown at all.

The button shows a GitHub icon if the remote is GitHub, or a generic Git icon otherwise.

### What sync does

Clicking the sync button runs these steps in order:

1. `git pull --ff-only` — pull changes from the remote using fast-forward only
2. `git status --porcelain` — check for local changes
3. `git add -A` — stage all changes (if any)
4. `git commit -m "Update Tektite vault"` — commit staged changes (if any)
5. `git push` — push to the remote

A log dialog shows the output of each step in real time so you can see what happened.

### Authentication — no interaction expected

Tektite runs Git in a non-interactive mode (`GIT_TERMINAL_PROMPT=0`). This means Git will never pause to ask for a username or password. Sync is designed for SSH-based remotes where authentication is handled silently by the SSH agent.

**Expected setup:** your remote uses an SSH URL (e.g. `git@github.com:you/vault.git`) and your SSH key is either:
- passwordless (no passphrase), so SSH can use it directly, or
- loaded into the SSH agent (`ssh-add`) so the agent authenticates silently on your behalf.

**If authentication would fail** (e.g. the SSH key has a passphrase and no agent is running), Tektite checks SSH connectivity to the remote host before attempting the pull. If the check fails, it shows a warning message in the log dialog before proceeding. The sync attempt continues — it will fail fast with an auth error rather than hanging.

**HTTPS remotes** work if Git's credential helper is configured to respond silently (e.g. macOS Keychain). If the credential helper requires interaction, the pull and push will fail with an auth error (they will not hang, because `GIT_TERMINAL_PROMPT=0` prevents prompts).

### Manual Git operations

Tektite does not provide a full Git interface. For anything beyond the one-click sync (managing branches, resolving merge conflicts, viewing history), use a terminal or a Git GUI tool directly on the vault folder.

---

## Templates

Templates let you pre-populate new notes with reusable content — useful for meeting notes, daily journals, project briefs, or any note type you create repeatedly.

### Setting up templates

Create a folder inside your vault to hold template files. By default Tektite looks for `.tektite/templates` (relative to the vault root). You can change this path in [Settings](#settings).

Add one `.md` file per template to that folder. The file name becomes the template name shown in the New Note dialog. Example:

```
my-vault/
  .tektite/
    templates/
      Meeting Notes.md
      Daily Journal.md
      Project Brief.md
```

### Using a template

1. Create a new note via the context menu, **File › New Node**, or `Cmd+Shift+N`.
2. The **New Note** dialog shows a **Template** dropdown if at least one template file exists in the configured folder.
3. Choose a template or leave it at **None** for a blank note.
4. Enter the note name and click **Create**.

The new note is pre-populated with the full content of the chosen template file.

### Tips

- Templates are plain Markdown files — edit them in Tektite like any other note.
- The `.tektite/` folder is hidden in the file tree (dot-prefix convention) so templates don't clutter your vault view.
- If no templates folder exists or it is empty, the dropdown does not appear in the dialog.

---

## Settings

Open Settings via:

- The **cog icon** (⚙) in the sidebar toolbar
- **File › Settings…** (`Cmd+,`)
- **Tektite › Settings…** (`Cmd+,`) on macOS

### Templates folder

The path to the folder containing template files, relative to the vault root. Default: `.tektite/templates`.

Leave blank to use the default. Any valid relative path works — for example `_templates` or `docs/templates`.

Settings are saved per vault in `.tektite/settings.json` inside the vault root. This file is hidden from the file tree and can be committed to Git alongside the vault if you want to share settings across machines.

---



### Resizing panes

Drag the vertical divider between the sidebar and the workspace to resize the sidebar. Drag the vertical divider inside the workspace to change the split between the editor and preview.

Drag the horizontal dividers inside the sidebar to resize the Tags and Graph panes relative to each other and to the file tree.

All layout sizes are saved automatically and restored on next launch.

### Dark and light mode

Click the **theme toggle** button in the toolbar, or use **View › Toggle Dark/Light Mode**. The default is dark mode. The preference is saved.

### Multiple windows

Use **File › New Window** (`Cmd+N`) to open a second window. Each window is independent and can have a different vault open. The **Window** menu lists all open windows and lets you switch between them.

---

## Terminal

An integrated terminal pane can be shown at the bottom of the workspace, spanning across the editor and preview panes.

### Showing the terminal

Open the terminal via **View › Show Terminal**. A checkmark appears next to the menu item when the terminal is visible. The pane persists its visibility state across sessions.

### Using the terminal

The terminal runs your system's default shell (e.g. `zsh` on macOS). It starts in the directory of the currently open vault, or in your home directory if no vault is open.

Type commands as you would in any terminal. The working directory is not automatically changed when you switch vaults — use `cd` to navigate.

### Collapsing the terminal

Click the **`-`** button in the terminal header to collapse the content area, keeping only the header bar visible. The editor and preview panes expand to fill the reclaimed space. Click **`+`** to expand again.

### Font and theme support

If you use a shell theme such as Oh My Zsh with Powerlevel10k, install a Nerd Font (e.g. **MesloLGS NF**) and configure it as your terminal font to ensure icons and special glyphs render correctly. Tektite looks for Nerd Fonts automatically; the glyph icons appear when a compatible font is installed on your system.

### Resizing the terminal

Drag the thin horizontal divider between the workspace and the terminal header to resize the pane height.

---

## Keyboard Shortcuts

| Action | Shortcut |
|---|---|
| **File** | |
| Open Vault | `Cmd+O` |
| New Note | `Cmd+Shift+N` |
| New Folder | `Cmd+Shift+F` |
| New Window | `Cmd+N` |
| Print | `Cmd+P` |
| Close Tab | `Cmd+W` |
| Close Window | `Cmd+Shift+W` |
| Open Settings | `Cmd+,` |
| **Edit** | |
| Undo | `Cmd+Z` |
| Redo | `Cmd+Shift+Z` |
| **View** | |
| Refresh Vault | `Cmd+R` |
| **Editor** | |
| Find in file | `Cmd+F` |
| Rename selected entry | `Cmd+Shift+R` |
| Delete selected entry | `Cmd+Backspace` *(file tree focused)* |
| Toggle bullet list | `Cmd+Shift+8` |
| **General** | |
| Dismiss dialogs | `Esc` |
