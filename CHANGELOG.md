# Changelog

All notable changes to Tektite are documented here.

## [0.1.23] - 2026-05-28

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
