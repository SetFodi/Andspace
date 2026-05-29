# AndSpace Security Notes

Last updated: May 29, 2026

These notes describe the current security posture of AndSpace
`v0.1.0-alpha.5`. This is an early public alpha, not a hardened or notarized
stable release.

## Current Alpha Status

- macOS first.
- Apple Silicon focused.
- zsh-first shell integration.
- Not signed with a Developer ID certificate yet.
- Not notarized by Apple yet.
- No auto-update mechanism yet.
- No account required.
- No provider API integration or hidden API billing.

Because the app is not notarized yet, macOS may block first launch after
download. This is expected for the current alpha. You may need to right-click
`AndSpace.app` and choose Open, or allow it from System Settings -> Privacy &
Security after the first blocked launch attempt.

## Verify Downloads

Before installing or sharing an alpha build, verify the downloaded ZIP or DMG
against the published SHA-256 checksum.

See [VERIFY_DOWNLOAD.md](VERIFY_DOWNLOAD.md) for exact commands and expected
checksums.

## Command Guard

Command Guard is a safety rail for terminal commands. It can:

- Warn about protected commands.
- Warn about dangerous commands.
- Read project guidance from `ANDSPACE.md`.
- Require explicit confirmation before selected commands continue.

Command Guard does not:

- Sandbox shell commands.
- Make arbitrary commands safe.
- Understand every program's side effects.
- Replace user judgment.
- Protect against malicious software already running on the machine.

## Git Features

Git features are read-only in this alpha. AndSpace can show Git status and
read-only diff previews.

The UI does not provide Git write actions:

- No staging.
- No commit UI.
- No push or pull.
- No checkout or branch switching.
- No reset.
- No stash.
- No merge or rebase.

Risky Git commands typed manually in the terminal are still terminal commands.
Command Guard may warn about dangerous patterns, but it is not a Git sandbox.

## Shell Execution

AndSpace starts terminal shells and runs user-triggered local actions such as:

- Package scripts selected from the sidebar.
- External editor handoff.
- Read-only Git status and diff commands.
- Local AI CLI handoff.

AndSpace does not intentionally run hidden shell commands unrelated to user
actions. Local shell startup files, installed CLIs, package scripts, and project
tooling are controlled by the user's machine and project.

## AI CLI Handoff

AI handoff uses local installed CLIs only: Claude Code, Codex, and Cursor CLI.
Any provider-side behavior is controlled by those tools and their provider
terms. AndSpace does not proxy provider traffic and does not include hidden API
billing.

## Reporting Security Issues

For non-sensitive issues, use GitHub issues:
https://github.com/SetFodi/Andspace/issues

For sensitive security concerns, do not post secrets, tokens, or working exploit
details publicly. Open a minimal issue asking for a private reporting path, or
use GitHub private vulnerability reporting if it is available on the repository.
