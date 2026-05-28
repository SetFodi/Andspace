# v0.1-alpha Release Checklist

Target tag: `v0.1.0-alpha.1`

This checklist is for the first usable v0.1-alpha build. It covers release
readiness only: no Git panel, settings UI, embedded browser preview, file
editing, search panel, or new sidebar sections.

## Build Checks

- [x] `pnpm exec tsc --noEmit`
- [x] `pnpm build`
- [x] `cargo test --manifest-path src-tauri/Cargo.toml`
- [x] `cargo check --manifest-path src-tauri/Cargo.toml`
- [x] `scripts/verify-command-guard-zsh.sh`
- [x] `scripts/test-server-detection.mjs`
- [x] `scripts/test-pane-navigation.mjs`
- [x] `pnpm tauri build`

If `pnpm tauri build` fails because of signing or notarization, record the
exact error and do not work around it for alpha.

## Production App Sanity

- [x] Built `.app` launches from
  `src-tauri/target/release/bundle/macos/AndSpace.app`
- [x] App name is `AndSpace`
- [ ] App icon appears in Finder / Dock / app switcher
- [x] No placeholder dev icon is packaged
- [x] Terminal opens with a shell prompt
- [ ] `Cmd+K` opens the command palette
- [ ] `Cmd+B` opens and focuses the sidebar

## Manual UX Checks

- [ ] App launch opens one tab and one active terminal pane
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

## Performance Sanity

- [x] Idle with sidebar closed has no visible CPU churn
- [ ] Idle with sidebar open has no visible CPU churn
- [ ] Dev server output can run while Servers updates without UI stalls
- [x] No new background port scanning, polling, network checks, or filesystem
  watchers were added

## Current Run Notes

- Automated build checks passed on May 28, 2026.
- `pnpm tauri build` succeeded and produced:
  `src-tauri/target/release/bundle/macos/AndSpace.app`
- Bundle metadata shows `CFBundleDisplayName=AndSpace`,
  `CFBundleName=AndSpace`, `CFBundleShortVersionString=0.1.0-alpha.1`,
  `CFBundleVersion=0.1.0-alpha.1`,
  `CFBundleIdentifier=com.andspace.desktop`, and
  `CFBundleIconFile=icon.icns`.
- Packaged icon is a real macOS `.icns` file at
  `Contents/Resources/icon.icns` (634734 bytes).
- Production app launched as process `andspace`.
- Runtime diagnostics showed `app-start`, `pty-create`, `shell-autoload`,
  `renderer=webgl`, and shell cwd OSC events.
- Idle process sampling with sidebar presumed closed: five 1-second samples
  at `0.0%` CPU and about `100 MB` RSS.
- Visual UI verification was blocked in this environment: Computer Use timed
  out, `osascript` was denied Accessibility permission for keystrokes/window
  inspection, and `screencapture` could not create an image from the display.
  The remaining unchecked UI items need manual verification on the desktop.

## Alpha Changelog

### v0.1.0-alpha.1

- Phase 0 terminal foundation approved
- Terminal tabs, splits, and pane focus navigation
- Command Guard with `ANDSPACE.md` rules
- `ANDSPACE.md` initializer
- AI CLI handoff through local Claude Code, Codex, and Cursor CLIs
- Command palette
- Optional project sidebar with Files, Scripts, and Servers
- File Actions for external editor handoff
- Passive local server detection from terminal output
- Shortcut cleanup for v0.1-alpha
