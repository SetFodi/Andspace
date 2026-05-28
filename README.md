# AndSpace

AndSpace is a terminal-first macOS app built with Tauri 2, Rust, and xterm.js.
The current v0.1-alpha focuses on a reliable local workflow: terminal tabs and
splits, command safety, AI CLI handoff, and a lightweight project sidebar.

## Current v0.1-alpha

- Terminal tabs, splits, and pane focus navigation
- Workspace restore for tabs, splits, cwd, sidebar state, and window shape
- Command Guard with project rules from `ANDSPACE.md`
- `Cmd+Shift+I` initializer for `ANDSPACE.md`
- AI handoff through installed local Claude Code, Codex, or Cursor CLIs
- Command palette for core workflow actions
- Optional project sidebar with Files, Scripts, and Servers
- File Actions for Cursor, VS Code, Neovim split, copy path, and Finder reveal
- Passive localhost server detection from terminal output

AndSpace does not call provider APIs, manage API keys, or create API billing.
AI handoff is local CLI orchestration only.

## Run

```bash
pnpm install
pnpm build
pnpm tauri dev
```

First `pnpm tauri dev` compiles all Cargo dependencies. Subsequent runs are
incremental. `pnpm build` populates `dist/`, which Tauri validates at compile
time.

## Build

```bash
pnpm tauri build
```

The release app is written to:

```text
src-tauri/target/release/bundle/macos/AndSpace.app
```

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
| `Cmd+E` | Send context |
| `Cmd+/` | Keyboard shortcuts |
| `Cmd+Shift+I` | Create `ANDSPACE.md` |
| `Cmd+[` / `Cmd+]` | Previous / next tab |
| `Cmd+1`-`Cmd+9` | Jump to tab |

## Docs

- [v0.1 status](docs/V0_1.md)
- [release checklist](docs/V0_1_RELEASE_CHECKLIST.md)
- [dogfood checklist](docs/DOGFOOD_CHECKLIST.md)
- [workspace persistence](docs/WORKSPACE_PERSISTENCE.md)
- [Command Guard](docs/COMMAND_GUARD.md)
- [AI handoff](docs/AI_HANDOFF.md)
- [Command Palette](docs/COMMAND_PALETTE.md)
- [Project Sidebar](docs/PROJECT_SIDEBAR.md)
- [Servers](docs/SERVERS.md)
- [File Actions](docs/FILE_ACTIONS.md)
