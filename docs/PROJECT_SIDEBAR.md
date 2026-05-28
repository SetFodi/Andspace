# Project Sidebar

The v0.1 project sidebar is optional and hidden by default. It is a small
terminal companion for Files and Scripts only, not an IDE sidebar.

## Behavior

- `Cmd+B` toggles the sidebar.
- `Cmd+Left` focuses the sidebar; `Esc` returns focus to the terminal.
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
- `Run Script`
- `Go to File` (compact file picker over the loaded project tree)

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
```

## Limits

- No Git panel.
- No server detection.
- No file editing.
- No full file preview.
- No settings UI.
- No background watchers.
- No indexing `node_modules`.
