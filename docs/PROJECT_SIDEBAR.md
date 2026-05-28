# Project Sidebar

The v0.1 project sidebar is optional and hidden by default. It is a small
terminal companion for **Files, Scripts, and Servers** only — not an IDE
sidebar.

## Behavior

- `Cmd+B` toggles the sidebar **and focuses the first file row** so arrow
  keys work immediately. Pressing `Cmd+B` again closes it and returns
  focus to the terminal.
- `Cmd+0` opens the sidebar if needed and focuses it without toggling.
- `Cmd+Left` moves pane focus left first. If the active pane is already the
  leftmost pane, it focuses the sidebar. While the sidebar is focused,
  `Cmd+Right` returns focus to the active terminal pane.
- `Esc` returns focus to the terminal.
- Inside the sidebar: `↑` / `↓` walk rows (wraps, scrolls into view),
  `→` / `←` expand / collapse a directory, `Home` / `End` jump to first /
  last row.
- The sidebar walks upward from the active pane cwd looking for a project
  marker (`package.json`, `pnpm-lock.yaml`, `yarn.lock`, `bun.lockb`,
  `Cargo.toml`, `.git`) and uses the first match as the displayed root. If
  no marker is found it falls back to the active pane cwd.
- It does not scan until opened.
- It does not watch the filesystem.
- It refreshes on reopen or by using the refresh button.
- All data is cached only in memory.

## Files

The Files section loads a shallow directory tree and ignores heavy directories:

- `node_modules`
- `.git`
- `dist`
- `build`
- `.next`
- `target`
- `vendor`

Folders can be expanded and collapsed. Clicking or pressing Enter on a file
opens the **File Actions** menu (Cursor / VS Code / Neovim split / Copy path /
Reveal in Finder). `Cmd+Enter` skips the menu and runs the default action.
AndSpace does not embed an editor and does not show a full preview — see
[FILE_ACTIONS.md](FILE_ACTIONS.md).

## Servers

The Servers section lists local dev URLs that AndSpace has seen in terminal
output (Vite, Next.js, NestJS, etc.). Detection is best-effort, comes only
from terminal text, and **does no port scanning, no polling, and no fetches**.
Click a row to open in the default browser; right-click or `⌘C` to copy the
URL. Full behavior in [SERVERS.md](SERVERS.md).

## Scripts

The Scripts section reads `package.json` in the project root and lists scripts.
Common scripts are ordered first: `dev`, `build`, `lint`, `test`, then any
others alphabetically.

Package manager detection is intentionally simple:

1. `pnpm-lock.yaml` → `pnpm <script>`
2. `bun.lockb` → `bun run <script>`
3. `yarn.lock` → `yarn <script>`
4. fallback → `npm run <script>`

Clicking a script opens a split-right pane and runs it from the project root.

## Command Palette

`Cmd+K` includes lightweight sidebar commands:

- `Toggle Sidebar`
- `Focus Files`
- `Focus Scripts`
- `Focus Servers`
- `Run Script`
- `Go to File` (compact file picker over the loaded project tree)
- `Open Localhost Preview`
- `Copy Server URL`

`Run Script` opens the sidebar focused on Scripts so the user can choose the
script explicitly.

## Diagnostics

Diagnostics are written to `/tmp/andspace-diag.log`:

```text
sidebar-open
sidebar-close
project-tree-load cwd=/repo
project-tree-expand path=/repo/src
project-root-resolve cwd=/repo/src/components root=/repo marker=package.json
package-scripts-load cwd=/repo
script-run name=dev package_manager=pnpm cwd=/repo
file-action-open target=cursor path=/repo/src/main.ts
file-action-open target=copy path=/repo/src/main.ts
file-action-open target=finder path=/repo/src/main.ts
file-picker-open cwd=/repo
file-picker-select path=/repo/src/main.ts
server-detected url=http://localhost:5173 pane=pane-abc label=Vite
server-open url=http://localhost:5173
server-copy url=http://localhost:5173
```

## Limits

- No Git panel.
- No background server scanning.
- No embedded server preview.
- No file editing.
- No full file preview.
- No settings UI.
- No background watchers.
- No indexing `node_modules`.
