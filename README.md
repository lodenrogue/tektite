# Tektite

Tektite is a local-first Markdown knowledge base app for macOS and Linux. It opens a local folder as a vault, lets you write Markdown notes, shows a live preview, and draws a graph of how notes are connected.

There is no login, cloud sync, telemetry, remote storage, or account system. Your vault is just a folder on disk.

## Features

- Open any local folder as a vault.
- Reopen previously used vaults from `File > Recent Vaults...`.
- Browse folders, Markdown notes, and image assets in a collapsible file tree.
- Resize the sidebar, editor, preview, and graph areas.
- Create new notes and folders from the file tree context menu.
- Delete files and folders from the file tree context menu.
- Move files, folders, and images by dragging them in the file tree.
- Automatically update Markdown image references when an image is moved.
- Toggle visible file extensions in the file tree.
- Edit Markdown with autosave.
- Use native-style undo and redo history in the editor.
- Live Markdown preview.
- Click Markdown links and `[[wikilinks]]` in preview to open linked notes.
- Use the Preview back button to return after following a preview link.
- Type `@` in the editor to insert a Markdown link to another note.
- Drag files, folders, or images from the file tree into the editor to insert Markdown links or image embeds.
- Drag images from Finder into the editor or file tree to import and embed them.
- View a graph of note-to-note links.
- Click graph nodes to open notes.
- Zoom the graph with the mouse wheel.
- Pan the graph by dragging empty space.
- Drag individual graph nodes to reposition them.
- Toggle dark and light mode. Dark mode is the default.
- Custom Tektite app icon, splash screen, and About dialog.

## Run

```sh
npm install
npm start
```

On macOS, `npm start` launches a local packaged `Tektite.app` so the Dock and menu bar show `Tektite` instead of Electron.

For faster development startup, use:

```sh
npm run dev
```

In dev mode on macOS, the host process may still appear as Electron.

## Icon Tools

Generate app icons from the current source image:

```sh
./make_rounded_icon.sh Gemini_Generated_Image_825sfh825sfh825s.png assets/icons/tektite-icon.icns
```

The script creates a rounded macOS `.icns` file from a PNG source. The app also uses `assets/icons/tektite-icon.png`, `assets/icons/tektite.iconset`, and `tektive-icon.webp` for runtime and packaging assets.

## Packaging

```sh
npm run generate-icons
npm run package:mac
npm run package:linux
```

The package scripts use the `electron-packager` CLI provided by `@electron/packager`. Install dependencies first with `npm install`.

## Author

Tektite was created by Mathias Conradt.

Copyright © 2026 Mathias Conradt.

Released under the MIT License.
