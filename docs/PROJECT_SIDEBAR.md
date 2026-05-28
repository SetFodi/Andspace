# Project Sidebar

The v0.1 project sidebar is optional and hidden by default. It is a small
terminal companion for Files and Scripts only, not an IDE sidebar.

## Behavior

- `Cmd+B` toggles the sidebar.
- The sidebar uses the active pane cwd as the project root.
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

Folders can be expanded and collapsed. Clicking a file copies its path and shows
a small toast. It does not open an editor and does not show a full preview.

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

`Run Script` opens the sidebar focused on Scripts so the user can choose the
script explicitly.

## Diagnostics

Diagnostics are written to `/tmp/andspace-diag.log`:

```text
sidebar-open
sidebar-close
project-tree-load cwd=/repo
package-scripts-load cwd=/repo
script-run name=dev package_manager=pnpm cwd=/repo
```

## Limits

- No Git panel.
- No server detection.
- No file editing.
- No full file preview.
- No settings UI.
- No background watchers.
- No indexing `node_modules`.
