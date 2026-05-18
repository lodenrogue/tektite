# Tektite

Tektite is a local-first Markdown knowledge base app for macOS and Linux. It opens a local folder as a vault, lets you edit Markdown notes, shows a live preview, and draws a graph of note links.

## Run

```sh
npm install
npm start
```

On macOS, `npm start` launches a local packaged `Tektite.app` so the Dock and menu bar show `Tektite` instead of Electron. Use `npm run dev` for faster Electron dev-mode startup, where macOS may still label the host process as Electron.

## Current scope

- Open a local folder as a vault.
- Browse folders and `.md` files.
- Create, read, edit, and save Markdown notes.
- Live Markdown preview with `[[wikilinks]]` and Markdown links.
- Graph view for note-to-note links.
- No login, auth, cloud sync, telemetry, or remote storage.

## Packaging

```sh
npm run generate-icons
npm run package:mac
npm run package:linux
```

The package scripts use the `electron-packager` CLI provided by `@electron/packager`. Install dependencies first with `npm install`.
