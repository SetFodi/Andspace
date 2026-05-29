# AndSpace v0.1.0-alpha.3 Release Notes

AndSpace `v0.1.0-alpha.3` is a packaging and distribution update for the public
macOS alpha. It exists because DMG packaging and signing/notarization readiness
were added after `v0.1.0-alpha.2` was already published.

- Website: https://andspace.app
- GitHub release: https://github.com/SetFodi/Andspace/releases/tag/v0.1.0-alpha.3

## What Changed Since alpha.2

- Added a Tauri DMG bundle target.
- Kept the ZIP workflow for direct app bundle distribution.
- Added `scripts/package-alpha.sh` for repeatable local packaging.
- Added SHA256 checksum generation for release artifacts.
- Added macOS signing/notarization readiness docs.
- Updated unsigned alpha install instructions.

There are no major app feature changes from `v0.1.0-alpha.2` in this release.

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
   [GitHub release](https://github.com/SetFodi/Andspace/releases/tag/v0.1.0-alpha.3).
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
| ZIP | `src-tauri/target/release/bundle/macos/AndSpace-v0.1.0-alpha.3-macos.zip` |
| DMG | `src-tauri/target/release/bundle/dmg/AndSpace_0.1.0-alpha.3_aarch64.dmg` |
| Checksums | `src-tauri/target/release/bundle/AndSpace-v0.1.0-alpha.3-checksums.txt` |
| Updater artifact | Not generated |

## Checksums

```text
2b12be781dbc85dbc80527ffba2110d9f2c804588c782158acc95e631a896e3a  src-tauri/target/release/bundle/macos/AndSpace-v0.1.0-alpha.3-macos.zip
c95fa512a686b68961ad04594ad44bd8c7743f7117967cc60843c73a26c4d43d  src-tauri/target/release/bundle/dmg/AndSpace_0.1.0-alpha.3_aarch64.dmg
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
