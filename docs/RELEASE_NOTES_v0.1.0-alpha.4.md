# AndSpace v0.1.0-alpha.4 Release Notes

AndSpace `v0.1.0-alpha.4` is a hotfix release for public alpha distribution.
It keeps the same product surface as `v0.1.0-alpha.3` and focuses on shell
startup reliability plus local AI CLI handoff behavior.

- Website: https://andspace.app
- GitHub release: https://github.com/SetFodi/Andspace/releases/tag/v0.1.0-alpha.4

## What Changed Since alpha.3

- Fixed AI CLI handoff cwd behavior. Claude Code and Cursor CLI handoffs now
  launch from the active pane's current working directory.
- Fixed Codex interactive launch. Codex no longer receives the prompt through
  stdin, because interactive Codex requires stdin to remain attached to the
  terminal.
- Temporary handoff prompt files are still removed after launch.
- Improved zsh startup reliability by loading the user's login profile setup
  before `.zshrc`, matching normal macOS terminal behavior more closely.

There are no major app feature changes from `v0.1.0-alpha.3` in this release.

## Included App Features

- Terminal tabs and split panes.
- Pane focus navigation with `Cmd+Arrow`.
- Workspace restore for tabs, splits, cwd, sidebar state, and window shape.
- Command Guard with project rules from `ANDSPACE.md`.
- AI CLI handoff to installed local Claude Code, Codex, and Cursor CLIs.
- Command palette and keyboard shortcuts overlay.
- Optional project sidebar with Files, Scripts, Servers, and Git Changes.
- File Actions for Cursor, VS Code, Neovim split, copy path, and Finder reveal.
- Passive localhost detection from terminal output.
- Read-only Git Changes and Git Diff Preview.

## Installation

1. Download the macOS ZIP or DMG from the
   [GitHub release](https://github.com/SetFodi/Andspace/releases/tag/v0.1.0-alpha.4).
2. If you downloaded the DMG, open it and drag `AndSpace.app` to Applications.
3. If you downloaded the ZIP, unzip it and move `AndSpace.app` to
   `/Applications` if desired.
4. Launch AndSpace.

This prerelease alpha is not signed with a Developer ID and is not notarized
yet. If macOS blocks first launch, open System Settings -> Privacy & Security
and choose "Open Anyway" for AndSpace, or right-click `AndSpace.app` in Finder
and choose Open.

## Artifacts

| Artifact | Path |
| --- | --- |
| App bundle | `src-tauri/target/release/bundle/macos/AndSpace.app` |
| ZIP | `src-tauri/target/release/bundle/macos/AndSpace-v0.1.0-alpha.4-macos.zip` |
| DMG | `src-tauri/target/release/bundle/dmg/AndSpace_0.1.0-alpha.4_aarch64.dmg` |
| Checksums | `src-tauri/target/release/bundle/AndSpace-v0.1.0-alpha.4-checksums.txt` |
| Updater artifact | Not generated |

## Checksums

```text
f0c60daec32bcd68f20f26e85a3a97d248fb69e88e3cd33c06ca3ee715244779  src-tauri/target/release/bundle/macos/AndSpace-v0.1.0-alpha.4-macos.zip
c9dacea732c7a0fd0fb99419ea75d4cc9f36e45d40ed78785c9649f560e43777  src-tauri/target/release/bundle/dmg/AndSpace_0.1.0-alpha.4_aarch64.dmg
```

## Known Limitations

- Not signed with a Developer ID.
- Not notarized.
- No auto-update.
- macOS-first and zsh-first.
- Local AI CLI handoff only; no provider API integration or API billing.
- No Git write actions: no staging, commit, push, pull, reset, checkout, stash,
  merge, or rebase UI.
- No embedded browser preview.
- No built-in editor.
- Server detection is passive and best-effort from terminal output only. It
  does not scan ports, poll, ping, or health-check servers.
- Git Diff Preview is read-only and capped for large diffs.

Signing and notarization readiness is tracked in
`docs/MACOS_SIGNING_NOTARIZATION.md`.
