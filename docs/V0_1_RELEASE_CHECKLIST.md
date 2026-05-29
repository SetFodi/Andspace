# v0.1-alpha Release Checklist

Target tag: `v0.1.0-alpha.5`

This checklist is for the first usable v0.1-alpha build. It covers release
readiness only: no write-capable Git client, settings UI, embedded browser
preview, file editing, search panel, or additional sidebar sections beyond
Files / Scripts / Servers / Git Changes.

## Build Checks

- [x] `pnpm tsc --noEmit`
- [x] `pnpm build`
- [x] `cargo test --manifest-path src-tauri/Cargo.toml`
- [x] `cargo check --manifest-path src-tauri/Cargo.toml`
- [x] `scripts/verify-command-guard-zsh.sh`
- [x] `scripts/test-server-detection.mjs`
- [x] `scripts/test-pane-navigation.mjs`
- [x] `scripts/test-workspace-persistence.mjs`
- [x] `pnpm tauri build`

If `pnpm tauri build` fails because of signing, notarization, or DMG packaging,
record the exact error and do not work around it for alpha.

## Production App Sanity

- [x] Built `.app` launches from
  `src-tauri/target/release/bundle/macos/AndSpace.app`
- [x] App name is `AndSpace`
- [x] App icon appears in Finder / Dock / app switcher
- [x] No placeholder dev icon is packaged
- [x] Terminal opens with a shell prompt
- [x] `Cmd+K` opens the command palette
- [x] `Cmd+B` opens and focuses the sidebar
- [ ] Holding the custom title bar drags the packaged app window

## Manual UX Checks

- [ ] App launch opens one tab and one active terminal pane
- [ ] Holding and dragging the title bar moves the window
- [ ] Double-clicking the title bar toggles macOS window zoom
- [ ] `Cmd+T` creates a new tab
- [ ] `Cmd+W` closes the active pane, or the tab when only one pane exists
- [ ] `Cmd+[` / `Cmd+]` switch tabs
- [ ] `Cmd+1`-`Cmd+9` jump to tabs
- [ ] `Cmd+O` splits right
- [ ] `Cmd+L` splits down
- [ ] `Cmd+Arrow` moves focus between terminal panes
- [ ] `Cmd+Left` moves to the left pane first, then focuses the sidebar from
  the leftmost pane
- [ ] `Cmd+Right` from the sidebar returns focus to the active terminal pane
- [ ] `Cmd+B` toggles the sidebar and focuses it on open
- [ ] `Cmd+0` focuses the sidebar without toggling
- [ ] Files section loads the project tree and supports expand / collapse
- [ ] Scripts section lists `package.json` scripts and runs one in a split
- [ ] Servers section stays quiet when empty
- [ ] Servers section shows detected localhost URLs from terminal output
- [ ] Clicking a server row opens the URL in the default browser
- [ ] Close and relaunch restores tabs, split layout, cwd values, sidebar
  state, active tab, and active pane.
- [ ] Restored panes are fresh shells with no old scrollback, command output,
  AI prompts, secrets, server records, or old processes.
- [ ] A pane whose saved cwd no longer exists falls back to the home
  directory.
- [ ] File Actions opens from a file row and closes with Escape
- [ ] Missing Cursor / VS Code / Neovim CLIs render disabled, not hidden
- [ ] Go to File opens from the command palette and closes with Escape
- [ ] Command Guard protected command shows confirmation and can cancel / run
- [ ] Command Guard dangerous command requires exact `run`
- [ ] `Cmd+E` opens handoff, previews context, copies prompt, and sends to an
  installed CLI when available
- [ ] `Cmd+K` opens the command palette and runs core actions
- [ ] `Cmd+/` opens the keyboard shortcuts overlay
- [ ] Escape closes the topmost overlay first
- [ ] Terminal focus returns after closing overlays

## Manual QA Required

Full visual UI automation is not reliable in this environment, so these items
must be checked manually in the launched production app:

- [x] `Cmd+K` opens the command palette
- [x] `Cmd+B` opens and focuses the sidebar
- [x] `Cmd+E` opens the handoff overlay
- [ ] Title bar drag moves the app window
- [ ] Workspace restore recreates layout/cwd/sidebar state with fresh shells
- [ ] `Cmd+/` opens the keyboard shortcuts overlay
- [ ] Command Guard overlay works for protected and dangerous commands
- [ ] File Actions open and run expected external handoff actions
- [ ] Server row opens the detected URL in the default browser
- [ ] Scripts run in a split
- [ ] Terminal focus returns after overlays close

## Dogfood Status

| Area | Status | Notes |
| --- | --- | --- |
| Automated checks | Passed | TypeScript, frontend build, Rust tests/check, Command Guard zsh verification, server parser tests, pane navigation tests |
| Production package | Passed | `pnpm tauri build` creates `AndSpace.app` and `AndSpace_0.1.0-alpha.5_aarch64.dmg` |
| Bundle metadata | Passed | App name, bundle id, version, executable, and icon metadata verified |
| Runtime diagnostics | Passed | PTY creation, WebGL renderer, shell autoload, and cwd OSC events verified |
| Visual UI workflow | Partial pass | `Cmd+K`, `Cmd+B`, and `Cmd+E` verified visually; full dogfood and remaining shortcuts still need manual confirmation |
| 60–90 minute dogfood | Needs manual confirmation | Use `docs/DOGFOOD_CHECKLIST.md` in the production app |

## Known Limitations

- macOS first.
- zsh first; bash/fish integration placeholders exist but are not fully
  supported.
- AI handoff uses installed local CLIs only. No provider API integration,
  provider billing, API key management, or hosted chat UI.
- The app bundle and DMG are built for local alpha use. Developer ID signing,
  notarization, and auto-update are not implemented yet. Current release remains
  unsigned/not-notarized until Apple credentials are configured.
- Git Changes is read-only; diff preview is capped and there is no commit,
  push, pull, staging, reset, checkout, stash, merge, or rebase UI yet.
- No embedded browser preview yet.
- No settings UI yet.
- No file editing or in-app file preview yet.
- Server detection is best-effort from terminal output only; no port scanning,
  polling, or health checks.

## Performance Sanity

- [x] Idle with sidebar closed has no visible CPU churn
- [ ] Idle with sidebar open has no visible CPU churn
- [ ] Dev server output can run while Servers updates without UI stalls
- [x] No new background port scanning, polling, network checks, or filesystem
  watchers were added

## Current Run Notes

- Automated build checks passed on May 29, 2026.
- `pnpm tauri build` succeeded and produced:
  `src-tauri/target/release/bundle/macos/AndSpace.app`
- DMG output was produced at:
  `src-tauri/target/release/bundle/dmg/AndSpace_0.1.0-alpha.5_aarch64.dmg`.
- `scripts/package-alpha.sh` produced:
  `src-tauri/target/release/bundle/macos/AndSpace-v0.1.0-alpha.5-macos.zip`
  and `src-tauri/target/release/bundle/AndSpace-v0.1.0-alpha.5-checksums.txt`.
- Latest local package checksums:
  `30ee2906e5a5c9891e1a90133aeb6799e323fad5ab99d8104f7e1ac2737da333`
  for the ZIP and
  `4eb5f491c771a235c03607efa8d62e7739e5133d5a4fbf6588fcb0ee945670e2`
  for the DMG.
- Bundle metadata shows `CFBundleDisplayName=AndSpace`,
  `CFBundleName=AndSpace`, `CFBundleShortVersionString=0.1.0-alpha.5`,
  `CFBundleVersion=0.1.0-alpha.5`,
  `CFBundleIdentifier=com.andspace.desktop`, and
  `CFBundleIconFile=icon.icns`.
- Packaged icon is a real macOS `.icns` file at
  `Contents/Resources/icon.icns` (634734 bytes).
- Production icon appearance was confirmed from the user-provided screenshot.
- Production app launched as process `andspace`.
- Runtime diagnostics showed `app-start`, `pty-create`, `shell-autoload`,
  `workspace-load`, `renderer=webgl`, `workspace-save`, and shell cwd OSC
  events.
- Production smoke checks confirmed `Cmd+K` opens the palette, `Cmd+B` opens
  and focuses the sidebar, and `Cmd+E` opens AI Handoff.
- Idle process sampling with sidebar presumed closed: five 1-second samples
  around `0.4–0.5%` CPU and about `105 MB` RSS.
- Computer Use timed out. `osascript` and screenshots were usable for a small
  smoke check, but global keystroke automation became unreliable when another
  app took focus. The remaining unchecked UI items need manual verification
  on the desktop.

## Alpha Changelog

### v0.1.0-alpha.1

- Phase 0 terminal foundation approved
- Terminal tabs, splits, and pane focus navigation
- Command Guard with `ANDSPACE.md` rules
- `ANDSPACE.md` initializer
- AI CLI handoff through local Claude Code, Codex, and Cursor CLIs
- Command palette
- Optional project sidebar with Files, Scripts, Servers, and read-only Git Changes / diff preview
- File Actions for external editor handoff
- Passive local server detection from terminal output
- Shortcut cleanup for v0.1-alpha
- Workspace persistence for tabs, splits, cwd, sidebar state, and window shape
- Native custom title-bar dragging in the packaged app

### v0.1.0-alpha.2

- Read-only Git Diff Preview
- Git Changes follows the active pane / tab and refreshes after active command
  completion
- Terminal render repair for stale WebGL/font-cell measurement issues
- Release notes and screenshot checklist for shareable alpha distribution
- Public README and launch copy for v0.1.0-alpha.2

### v0.1.0-alpha.3

- Packaging/distribution update after alpha.2 publication
- DMG packaging target added while keeping the ZIP workflow
- Packaging script for checks, Tauri build, ZIP generation, and SHA256 output
- DMG packaging target, packaging script, and signing/notarization runbook

### v0.1.0-alpha.4

- Hotfix release for AI CLI handoff cwd behavior
- Claude and Cursor handoffs launch from the active pane cwd
- Codex handoff keeps stdin attached to the terminal for interactive launch
- zsh startup now sources login profile setup before user `.zshrc`

### v0.1.0-alpha.5

- Hotfix release for CLI/editor detection from Finder/Dock-launched app bundles
- Claude, Codex, VS Code, Neovim, Vim, and Cursor detection now checks common
  Homebrew/user-bin locations instead of relying only on the app process PATH
- External editor launch uses the resolved absolute CLI path
- Terminal output hardening: larger PTY reads, compact PTY transport, bounded
  frontend backpressure, cheaper server-marker scanning, and lower retained
  scrollback
- Local AndSpace-vs-Ghostty benchmark harness added for repeatable dogfood
  throughput, CPU, memory, and terminal-drain comparisons
