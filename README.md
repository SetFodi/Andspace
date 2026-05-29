<p align="center">
  <img src="src/assets/logo.png" alt="AndSpace logo" width="96" height="96">
</p>

# AndSpace

AndSpace is a terminal-first macOS app for local development. It keeps the
terminal as the center of work, then adds lightweight helpers for project
context, command safety, local AI CLI handoff, server discovery, and read-only
Git inspection.

- Website: https://andspace.app
- Current alpha: `v0.1.0-alpha.3`
- Download: https://github.com/SetFodi/Andspace/releases/tag/v0.1.0-alpha.3

## What Is Included

- Terminal tabs and split panes
- Pane focus navigation with `Cmd+Arrow`
- Workspace restore for tabs, splits, cwd, sidebar state, and window shape
- Command Guard with project rules from `ANDSPACE.md`
- AI CLI handoff to installed local Claude Code, Codex, and Cursor CLIs
- Command palette and keyboard shortcuts overlay
- Optional project sidebar with Files, Scripts, Servers, and Git Changes
- File Actions for Cursor, VS Code, Neovim split, copy path, and Finder reveal
- Passive localhost server detection from terminal output
- Read-only Git Changes
- Read-only Git Diff Preview

AndSpace does not call provider APIs, manage API keys, or create API billing.
AI handoff is local CLI orchestration only.

## Screenshots

Current public screenshots live in `docs/screenshots/final/`. The full capture
checklist is tracked in [docs/screenshots/README.md](docs/screenshots/README.md).

![AndSpace main window with sidebar](docs/screenshots/final/01-hero-sidebar.png)

![Command palette](docs/screenshots/final/04-command-palette.png)

![Keyboard shortcuts overlay](docs/screenshots/final/07-keyboard-shortcuts.png)

Planned screenshot set:

| Screenshot | State |
| --- | --- |
| `01-hero-sidebar.png` | Main window with sidebar and split panes |
| `02-command-guard.png` | Command Guard overlay, needs capture |
| `03-ai-handoff.png` | `Cmd+E` AI handoff overlay, needs capture |
| `04-command-palette.png` | `Cmd+K` command palette |
| `05-git-diff-preview.png` | Read-only Git Diff Preview, needs capture |
| `06-servers.png` | Servers section with detected localhost |
| `07-keyboard-shortcuts.png` | Keyboard shortcuts overlay |

## Install The Alpha

1. Download the macOS ZIP or DMG from the
   [v0.1.0-alpha.3 GitHub release](https://github.com/SetFodi/Andspace/releases/tag/v0.1.0-alpha.3).
2. For a ZIP, unzip it. For a DMG, open it and drag `AndSpace.app` to
   Applications.
3. Move `AndSpace.app` to `/Applications` if you downloaded the ZIP.
4. Launch AndSpace.

This prerelease alpha is not signed with a Developer ID and is not notarized
yet. If macOS blocks the first launch, open System Settings -> Privacy &
Security and choose "Open Anyway" for AndSpace. You can also right-click
`AndSpace.app` in Finder and choose Open.

SHA-256 checksums from the latest local packaging run:

```text
2b12be781dbc85dbc80527ffba2110d9f2c804588c782158acc95e631a896e3a  AndSpace-v0.1.0-alpha.3-macos.zip
c95fa512a686b68961ad04594ad44bd8c7743f7117967cc60843c73a26c4d43d  AndSpace_0.1.0-alpha.3_aarch64.dmg
```

Local release packaging and checksum generation:

```bash
scripts/package-alpha.sh
```

## Alpha Limitations

- macOS-first, currently packaged for Apple Silicon
- zsh-first shell integration
- Prerelease alpha; expect rough edges
- Not signed with a Developer ID
- Not notarized
- No auto-update
- Local AI CLI handoff only
- No provider API billing or hosted AI backend
- No Git write actions: no staging, commit, push, pull, reset, checkout, stash,
  merge, or rebase UI
- No embedded browser preview
- No built-in editor

## Shortcuts

| Shortcut | Action |
| --- | --- |
| `Cmd+T` | New tab |
| `Cmd+W` | Close active pane / tab |
| `Cmd+O` | Split right |
| `Cmd+L` | Split down |
| `Cmd+Arrow` | Move focus between panes |
| `Cmd+Left` | From the leftmost pane, focus the sidebar |
| `Cmd+Right` | From the sidebar, return to the terminal |
| `Cmd+B` | Toggle sidebar |
| `Cmd+0` | Focus sidebar |
| `Cmd+K` | Command palette |
| `Cmd+E` | AI handoff |
| `Cmd+/` | Keyboard shortcuts |
| `Cmd+Shift+I` | Create `ANDSPACE.md` |
| `Cmd+[` / `Cmd+]` | Previous / next tab |
| `Cmd+1`-`Cmd+9` | Jump to tab |

## Development Setup

```bash
pnpm install
pnpm build
pnpm tauri dev
```

The first `pnpm tauri dev` run compiles Cargo dependencies. Later runs are
incremental. `pnpm build` populates `dist/`, which Tauri validates at compile
time.

## Build Locally

```bash
pnpm tauri build
```

The packaged macOS app is written to:

```text
src-tauri/target/release/bundle/macos/AndSpace.app
src-tauri/target/release/bundle/dmg/
```

## Documentation

- [v0.1 status](docs/V0_1.md)
- [release checklist](docs/V0_1_RELEASE_CHECKLIST.md)
- [dogfood checklist](docs/DOGFOOD_CHECKLIST.md)
- [macOS signing and notarization](docs/MACOS_SIGNING_NOTARIZATION.md)
- [workspace persistence](docs/WORKSPACE_PERSISTENCE.md)
- [Command Guard](docs/COMMAND_GUARD.md)
- [AI handoff](docs/AI_HANDOFF.md)
- [Command Palette](docs/COMMAND_PALETTE.md)
- [Project Sidebar](docs/PROJECT_SIDEBAR.md)
- [Servers](docs/SERVERS.md)
- [Git Changes](docs/GIT_CHANGES.md)
- [File Actions](docs/FILE_ACTIONS.md)
