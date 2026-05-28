# v0.1 Alpha Dogfood Checklist

Use this checklist for a real 60–90 minute local-dev session in the production
`AndSpace.app`. The goal is simple: can AndSpace replace Ghostty for one normal
work block without focus bugs, stale UI, or terminal friction?

## Setup

- [ ] Build the production app with `pnpm tauri build`.
- [ ] Launch
  `src-tauri/target/release/bundle/macos/AndSpace.app`.
- [ ] Open a normal local project with `cd /path/to/project`.
- [ ] Keep `/tmp/andspace-diag.log` visible in another terminal if debugging.

## First 10 Minutes — Terminal Basics

- [ ] App launches to one tab and one active terminal pane.
- [ ] Shell prompt appears within a few seconds.
- [ ] Typing feels immediate; no dropped characters.
- [ ] `Cmd+T` opens a new tab.
- [ ] `Cmd+W` closes the active pane / tab.
- [ ] `Cmd+[` and `Cmd+]` switch tabs.
- [ ] `Cmd+1`-`Cmd+9` jump to tabs.
- [ ] `Cmd+O` splits right.
- [ ] `Cmd+L` splits down.
- [ ] `Cmd+Arrow` moves focus between panes.
- [ ] `Cmd+Left` from the leftmost pane focuses the sidebar.
- [ ] `Cmd+Right` from the sidebar returns focus to the terminal.

## Next 20 Minutes — Real Local Dev

- [ ] Run one dev server:
  - [ ] `pnpm dev`
  - [ ] or `bun dev`
  - [ ] or `npm run dev`
- [ ] Confirm terminal output remains smooth while logs stream.
- [ ] Confirm Servers detects the printed localhost URL.
- [ ] Confirm repeated dev output does not create duplicate server rows.
- [ ] Click the server row and confirm it opens in the default browser.
- [ ] Stop the dev server with `Ctrl+C`.
- [ ] Confirm the server row disappears after the foreground command exits.
- [ ] Run a few normal commands (`ls`, `pwd`, `git status`, `pnpm test`).
- [ ] Confirm terminal focus still feels normal after command output.

## Sidebar — Files, Scripts, Servers

- [ ] `Cmd+B` opens the sidebar and focuses a row.
- [ ] `Cmd+B` again closes the sidebar and returns focus to the terminal.
- [ ] `Cmd+0` opens/focuses the sidebar without toggling it closed.
- [ ] Files section loads the project root, not a deep random cwd.
- [ ] `Up` / `Down` navigate rows.
- [ ] Plain `Left` / `Right` collapse and expand folders.
- [ ] Files section can refresh without losing the app.
- [ ] Scripts section lists `package.json` scripts.
- [ ] Clicking a script opens a split and runs from the package root.
- [ ] Servers section stays quiet when empty.
- [ ] Servers section shows detected localhost URLs when present.

## File Actions And Navigation

- [ ] Click a file row; File Actions opens.
- [ ] Escape closes File Actions and returns focus to the terminal.
- [ ] Missing Cursor / VS Code / Neovim CLIs are visibly disabled, not hidden.
- [ ] Open a file in Cursor if `cursor` is installed.
- [ ] Open a file in VS Code if `code` is installed.
- [ ] Open a file in a Neovim split if `nvim` is installed.
- [ ] Copy path works.
- [ ] Reveal in Finder works.
- [ ] `Cmd+K` → `Go to File` opens the picker.
- [ ] Go to File filtering feels instant on the loaded project tree.
- [ ] Selecting a file from Go to File opens File Actions.
- [ ] `Cmd+Enter` from Go to File runs the default file action.

## Overlays And Shortcuts

- [ ] `Cmd+K` opens Command Palette.
- [ ] Command Palette runs New Tab / Split Right / Split Down / Close Pane.
- [ ] Command Palette can focus Files / Scripts / Servers.
- [ ] Command Palette disables server actions when no server is known.
- [ ] `Cmd+E` opens AI Handoff.
- [ ] AI Handoff can preview and copy the redacted prompt.
- [ ] AI Handoff can send to an installed local CLI.
- [ ] `Cmd+/` opens Keyboard Shortcuts.
- [ ] Escape closes the topmost overlay first.
- [ ] Terminal input does not receive keystrokes while overlays are open.
- [ ] Terminal focus returns after every overlay closes.

## Command Guard

Use a temporary `ANDSPACE.md` rule set if the project has none:

```md
# ANDSPACE.md
<!-- andspace:version 1 -->

## Protected Commands
- echo protected-test

## Dangerous Commands
- echo dangerous-test
- rm -rf ./fake-folder

## Allowed
- echo protected-test allowed
```

- [ ] `Cmd+Shift+I` creates `ANDSPACE.md` only when missing.
- [ ] `echo protected-test` opens the protected confirmation overlay.
- [ ] Cancel prevents the protected command from running.
- [ ] Run once executes the protected command.
- [ ] `echo protected-test allowed` runs without confirmation.
- [ ] `echo dangerous-test` opens the dangerous confirmation overlay.
- [ ] Dangerous command requires exact `run`.
- [ ] Escape cancels Command Guard.
- [ ] While Command Guard is open, `Cmd+K`, `Cmd+E`, and `Cmd+/` do not steal
  focus.

## Close / Reopen

- [ ] Close AndSpace.
- [ ] Reopen the production app.
- [ ] Shell prompt appears again.
- [ ] Terminal input still feels normal.
- [ ] Sidebar can reopen and reload the project.
- [ ] Previously stopped server rows do not persist after relaunch.

## Performance Sanity

- [ ] Idle with sidebar closed has no visible CPU churn.
- [ ] Idle with sidebar open has no visible CPU churn.
- [ ] Streaming dev-server output does not make the UI stutter.
- [ ] Memory does not climb continuously during 60–90 minutes of normal use.
- [ ] No background port scans, health checks, or filesystem watchers appear in
  diagnostics.

## Notes

Record anything annoying enough to make you switch back to Ghostty:

- Focus bugs:
- Stuck overlays:
- Wrong shortcuts:
- Sidebar cwd/script mistakes:
- Server detection mistakes:
- CLI handoff/file action failures:
- Command Guard false positives/negatives:
- Terminal latency or rendering problems:
