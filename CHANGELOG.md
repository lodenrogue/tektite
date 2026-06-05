# Changelog

All notable changes to Tektite are documented here.

## [0.1.40] - 2026-06-06

- Fix: clicking a tag in the Tags pane now correctly clears the tag filter when clicked again (community contribution)

## [0.1.39] - 2026-06-06

- Open a vault by passing its path as a command-line argument: `npm start /path/to/vault` or `Tektite.app … /path/to/vault`
- If the app is already running and the vault is open, brings that window to front; otherwise opens it in a new window
- Invalid/missing paths show the "Vault Folder Not Found" dialog
- `npm start` now forwards extra arguments to the packaged binary

## [0.1.38] - 2026-06-02

- Table of Contents macro: insert linked note lists for the current folder from the formatting bar or `@` menu
- Settings: configure TOC macro as ordered/unordered list and optionally include subfolders

## [0.1.37] - 2026-06-01

- Editor: paste clipboard images directly into notes, saved beside the current node and inserted as Markdown image links
- Preview: reload now refreshes local image state, and missing images render as a broken-image placeholder
- Editor shortcuts: `Cmd+B` / `Cmd+I` toggle bold/italic on selected text
- Formatting bar: superscript button and `^text^` preview rendering
- File tree context menu: `Move...` dialog with indented folder picker

## [0.1.36] - 2026-05-31

- Formatting bar: numbered list toggle for ordered Markdown lists
- Formatting bar: table button inserts a 3x3 Markdown table placeholder
- Preview context menu: copy links from rendered preview content
- Fix: SonarQube maintainability cleanup in preview context-menu URL handling

## [0.1.35] - 2026-05-31

- Print current preview via File › Print... (`Cmd+P`) or the preview pane print icon
- Print uses the native system dialog, including macOS Save as PDF
- Fix: file tree markup now matches the custom tree role expected by SonarQube accessibility checks

## [0.1.38] - 2026-06-06

- Open a vault by passing its path as a command-line argument: `npm start /path/to/vault` or `Tektite.app … /path/to/vault`
- If the app is already running and the vault is already open, brings that window to front
- If the app is already running and the vault is not open, opens it in a new window
- If the vault path is invalid/missing, shows the same "Vault Folder Not Found" dialog as when a restored vault no longer exists
- The arg vault window is brought to focus after all restored windows open
- `npm start` now forwards extra arguments to the packaged binary

## [0.1.34] - 2026-05-30

- Settings: "Link bare URLs in preview" checkbox — auto-links plain `https://` URLs in preview when enabled (default: off)

## [0.1.33] - 2026-05-30

- Formatting bar: Bold, Italic, Strikethrough buttons (wrap/unwrap selection or insert placeholder)
- Fix: links no longer show as raw stash tokens (removed `_italic_` variant that corrupted stash keys)

## [0.1.32] - 2026-05-30

- Fix: nested unordered lists now render correctly with proper indentation in preview
- Fix: ordered lists (`1. Item`) now render as `<ol>` with nested support in preview
- Fix: nested list items no longer add extra bottom margin

## [0.1.31] - 2026-05-29

- Fix: drag and drop of files/folders in file tree restored (broken by mousedown preventDefault)
- Fix: `role="tree"` on file tree nav element resolves SonarQube tabindex accessibility warning

## [0.1.30] - 2026-05-29

- Formatting bar: Link and Image buttons insert markdown link/image syntax
- Selected URL text is automatically wrapped with filename as label; non-URL selection or no selection inserts placeholder

## [0.1.29] - 2026-05-29

- Expand All / Collapse All context menu actions on vault root and folder items

## [0.1.28] - 2026-05-29

- Active editor tab uses same green highlight as selected file tree node
- Selected folder in tree uses a darker green than selected file
- Cmd+W while file tree is focused keeps focus in tree after tab closes

## [0.1.27] - 2026-05-29

- Formatting toolbar in editor pane with H1–H4 heading toggles, horizontal rule insert, and list toggle
- Formatting buttons preserve editor selection (no focus steal on click)

## [0.1.25] - 2026-05-29

- Keyboard navigation in file tree: ↑/↓ navigate, →/← expand/collapse folders, Enter opens item, Tab moves to editor
- Clicking file tree keeps focus in tree; Tab moves focus to editor
- `Cmd+Backspace` deletes selected entry from tree
- `Cmd+Shift+F` creates new folder (global shortcut + File menu)
- `Cmd+Shift+R` renames selected entry (fixed conflict with `Cmd+R` refresh)
- `Cmd+Shift+N` / `Cmd+Shift+F` / `Cmd+Shift+R` / `Cmd+Backspace` shown in context menu
- New node/folder/rename/delete shortcuts respect currently selected tree item as target folder
- After rename, delete, or create folder: focus returns to file tree
- Fix: root-level files now align horizontally with root-level folder names

## [0.1.24] - 2026-05-29

- Show/Hide Editor Pane and Show/Hide Preview Pane in View menu (with checkmarks)
- All View menu toggles (editor, preview, tags, graph, file suffixes) now show checkmarks reflecting current state
- Fix: hiding editor pane no longer accidentally reveals hidden preview pane

## [0.1.23] - 2026-05-29

- `Cmd+Shift+8` toggles markdown bullet list on selected lines
- `Tab` inserts tab character in editor (multi-line selection indents all lines)
- Fix: rename no longer keeps old file copy alongside renamed file
- Fix: friendly error dialog when renaming to an already-existing filename

## [0.1.22] - 2026-05-27

- Note templates: pre-populate new notes from `.md` files in a configurable templates folder (default `.tektite/templates`)
- Settings dialog (cog icon / `Cmd+,` / File › Settings) to configure templates folder path per vault
- Settings menu item added to File menu and macOS app menu

## [0.1.21] - 2026-05-26

- Restore all open windows and vaults on app restart
- Splash screen reduced from 5 s to 3 s
- Fix: atomic workspace-state writes prevent 0-byte file corruption on multi-window startup
- Fix: SonarQube maintainability improvements

## [0.1.20] - 2026-05-25

- In-editor find bar (`Cmd+F`) with match highlighting overlay, prev/next navigation, match count
- Fix: tag extraction no longer picks up Markdown anchor links as tags

## [0.1.19] - 2026-05-24

- Help › Open Documentation menu item (opens user guide on GitHub)
- User guide published at `docs/user-guide.md`

## [0.1.18] - 2026-05-24

- Fix: SSH auth check uses controlled PATH (security hardening)

## [0.1.17] - 2026-05-23

- SSH authentication pre-check before git sync — warns user if auth will fail instead of timing out silently

## [0.1.16] - 2026-05-23

- Fix: SonarQube maintainability and code quality improvements

## [0.1.15] - 2026-05-22

- Collapsible Tags and Graph sidebar panes
- Fix: search field spacing polish

## [0.1.14] - 2026-05-22

- Tags pane with `#hashtag` collection and one-click filtering
- Content search (searches inside note bodies, not just filenames)
- View menu: show/hide Tags pane, Graph pane
- Tab menu actions

## [0.1.13] - 2026-05-21

- Fix: child tree nodes now indent correctly
- Fix: graceful handling of missing recent vaults

## [0.1.12] - 2026-05-20

- Visual optimizations

## [0.1.11] - 2026-05-20

- Window menu listing all open windows with focus switching

## [0.1.10] - 2026-05-19

- Fix: hardened git sync execution

## [0.1.9] - 2026-05-18

- Create new notes from `@` mention autocomplete

## [0.1.8] - 2026-05-17

- Git vault sync (`git pull --ff-only` → commit → push)
- Provider-specific sync icon (GitHub vs generic Git)

## [0.1.7] - 2026-05-16

- Intel Mac (x64) release artifact added to CI

## [0.1.2] – [0.1.6]

- Initial feature buildout: vault scanning, file tree, Markdown editor with autosave, live preview, graph view, wikilinks, drag-and-drop, image import, dark/light mode, recent vaults, multi-window support
