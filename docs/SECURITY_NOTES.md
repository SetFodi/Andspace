# AndSpace Security Notes

Last updated: May 29, 2026

These notes describe the current security posture of AndSpace
`v0.1.0-beta.1`. This is an early public beta, not a hardened stable
release.

## Current Beta Status

- macOS first.
- Apple Silicon focused.
- zsh-first shell integration.
- Managed zsh profile option for users who want a clean AndSpace-owned shell
  setup without sourcing personal dotfiles.
- Unsigned prerelease beta distribution.
- No auto-update mechanism yet.
- Manual update checks are user-triggered only.
- No account required.
- No provider API integration or hidden API billing.

Because this is an unsigned prerelease beta, macOS may block first launch
after download. This is expected for the current beta. You may need to
right-click `AndSpace.app` and choose Open, or allow it from System Settings ->
Privacy & Security after the first blocked launch attempt.

## Verify Downloads

Before installing or sharing a beta build, verify the downloaded ZIP or DMG
against the published SHA-256 checksum.

See [VERIFY_DOWNLOAD.md](VERIFY_DOWNLOAD.md) for exact commands and expected
checksums.

## Manual Update Checks

`Cmd+K` -> **Check for Updates** checks GitHub releases only when the user asks.
If a newer release exists, AndSpace opens the GitHub download/release page only
after the user chooses that action.

There is no automatic download, install, startup check, background polling,
telemetry, analytics, or diagnostic upload.

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

Git features are read-only in this beta. AndSpace can show Git status and
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

The managed zsh profile does not modify `~/.zshrc`, `~/.zprofile`, or
`~/.zshenv`. If the user chooses **Install missing** for recommended shell
tools, AndSpace runs Homebrew only for the visible package list shown in
Preferences. There is no silent package installation.

## Copy Diagnostics

Use `Cmd+K` -> **Copy Diagnostics** when reporting bugs. The copied block
includes app version, macOS version, architecture, renderer, shell integration
status, active cwd, preferences path, workspace path, diagnostics log path, and
install method when known.

It does not include terminal output, command history, AI prompts, secrets, Git
diffs, shell history, or environment variable values. Review the block before
posting publicly and remove any path or username you do not want to share.

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
