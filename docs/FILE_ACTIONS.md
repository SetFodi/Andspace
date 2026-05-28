# File Actions

AndSpace hands files off to the editor you already use instead of embedding
one. There is no built-in code editor and there is no file preview UI. Every
file action is a thin wrapper around an external tool.

## Where it triggers

Two surfaces invoke the same actions menu:

1. **Project sidebar (Files section)** — click or press Enter on any file row.
2. **Command Palette → Go to File (`Cmd+K`)** — type a filename, press Enter on
   a result.

In both surfaces, **`Cmd+Enter` skips the menu** and runs the default action
directly. Useful when you already know what you want.

## Available actions

The menu shows whichever of these are detected on `PATH` plus the two
always-available actions at the bottom:

| Action | Tool | What runs |
|---|---|---|
| Open in Cursor | `cursor` | `cursor <file>` (Cursor opens externally) |
| Open in VS Code | `code` | `code <file>` (VS Code opens externally) |
| Open in Neovim split | `nvim` | New split-right pane runs `nvim <file>` |
| Copy path | — | Writes absolute path to clipboard |
| Reveal in Finder | — | macOS `open -R <file>` |

If `cursor` / `code` / `nvim` is not on `PATH`, the corresponding action is
hidden from the menu — no dead UI.

## Default file action

The default action used by `Cmd+Enter` is picked dynamically:

1. Cursor, if installed
2. VS Code, if installed
3. Neovim split, if installed
4. Copy path (always wins as the last fallback)

This default is **temporary and detected**. A future settings UI will let
users override it explicitly. There is no settings UI in v0.1.

## Editor detection

`detect_external_editors` walks each entry on `PATH` once per session and
returns booleans for `cursor` / `code` / `nvim` / `vim`. The result is cached
in memory; AndSpace does not poll. Restart the app after installing a new
editor.

For Cursor and VS Code on macOS, the CLI binary is installed by running
"Shell Command: Install 'cursor' command in PATH" (Cursor) or
"Shell Command: Install 'code' command in PATH" (VS Code) from the Command
Palette inside that app once. If those commands aren't on `PATH`, AndSpace
won't see them.

## Go to File

`Cmd+K` → "Go to File" opens a compact picker over the loaded project tree:

- Substring match against filename and path.
- Filename matches outrank path matches.
- Up to 200 results shown — no heavy indexing.
- Uses the sidebar's loaded tree when available; if the sidebar hasn't been
  opened yet, the picker loads the tree once on first open.
- Files inside ignored folders (`node_modules`, `.git`, `dist`, `build`,
  `.next`, `target`, `vendor`) and beyond the sidebar's depth/count caps are
  not surfaced. This is deliberate — the picker is not a full code search.

## Diagnostics

All actions log a single grep-friendly line to `/tmp/andspace-diag.log`:

```text
file-action-open target=cursor path=/repo/src/main.ts
file-action-open target=code   path=/repo/src/main.ts
file-action-open target=nvim   path=/repo/src/main.ts
file-action-open target=copy   path=/repo/src/main.ts
file-action-open target=finder path=/repo/src/main.ts
file-picker-open  cwd=/repo
file-picker-select path=/repo/src/main.ts
project-root-resolve cwd=/repo/src/components root=/repo marker=package.json
```

`file-action-open-error` is logged with the same shape if a spawn fails.

## Out of scope (deferred)

- A real in-app code editor.
- File preview / read-only viewer.
- Full project-wide grep / "find in files".
- Settings UI for default file action.
- Right-click context menus (the keyboard-first menu is the only surface).
- Multi-file selection.
- Watching the filesystem for changes.
