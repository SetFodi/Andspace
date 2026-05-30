# AndSpace Privacy Notes

Last updated: May 29, 2026

This document is practical public-facing privacy information for the AndSpace
`v0.1.0-alpha.7` prerelease. It is not formal legal advice.

## Summary

- AndSpace does not require an account.
- AndSpace does not include provider API integrations or hidden API billing.
- AndSpace does not send terminal content, files, commands, AI prompts, Git
  diffs, workspace state, shell history, secrets, or command output to
  AndSpace servers.
- AI handoff uses locally installed command line tools only: Claude Code,
  Codex, and Cursor CLI.
- Lightweight workspace restore data is stored locally.
- Lightweight preferences are stored locally.
- Diagnostics are local.
- No app telemetry or analytics are added in this alpha.
- Update checking is manual and contacts GitHub only when requested.

## Local App Behavior

AndSpace is a local macOS terminal app. It starts local shells, renders terminal
output locally, and provides local workflow helpers such as Command Guard,
project sidebar actions, file actions, passive server detection, and read-only
Git status/diff views.

AndSpace does not run an AndSpace-hosted backend for terminal content,
workspace state, AI prompts, Git diffs, or files.

## AI CLI Handoff

AndSpace can hand context to locally installed AI command line tools when you
explicitly use the AI handoff action.

Supported local CLIs in this alpha:

- Claude Code
- Codex
- Cursor CLI

After a prompt is handed to a local CLI, any network behavior, account behavior,
retention, billing, or provider-side processing is controlled by that CLI and
the provider's own product terms and settings. AndSpace does not proxy those
requests and does not create hidden provider API billing.

## Local Workspace State

AndSpace may store lightweight workspace state locally so the app can restore a
working layout between launches.

Workspace persistence may include:

- Open tabs
- Split pane layout
- Active tab and pane
- Pane working directories
- Sidebar open/closed state
- Sidebar focused section
- Window size and position, when available

Workspace persistence does not store:

- Terminal scrollback
- Command output
- AI prompt contents
- Secrets
- Shell history
- Detected server records
- Git diff content

See [WORKSPACE_PERSISTENCE.md](WORKSPACE_PERSISTENCE.md) for implementation
details.

## Local Preferences

AndSpace stores lightweight preferences locally at:

```text
~/Library/Application Support/AndSpace/preferences.json
```

Preferences may include:

- First-run onboarding completed.
- Theme.
- Terminal font size.
- Scrollback profile.
- Default file action.
- Default AI CLI.
- Server open behavior.
- Workspace restore enabled/disabled.
- Command Guard enabled/disabled.

Preferences do not store terminal output, terminal scrollback, AI prompt
contents, secrets, Git diffs, command history, shell history, or detected
server records.

See [PREFERENCES.md](PREFERENCES.md) for details.

## Diagnostics

AndSpace may write local diagnostics to help debug launch, shell integration,
renderer, and packaging behavior during alpha testing. These diagnostics are
local files on the user's machine and are not uploaded automatically by
AndSpace.

The command palette action `Copy Diagnostics` copies a sanitized support block
with app version, macOS version, architecture, renderer, shell integration
status, active cwd, and local support paths. It does not include terminal
output, command history, AI prompts, secrets, Git diffs, shell history, or
environment variable values.

If you share diagnostics in a bug report, review them first and remove any
private paths, usernames, tokens, or project details you do not want to share.

## Manual Update Checks

The command palette action `Check for Updates` makes a user-triggered request
to GitHub releases so AndSpace can compare the latest public release tag with
the current app version.

AndSpace does not check for updates on startup, does not poll in the
background, does not install updates automatically, and does not send terminal
content, workspace data, diagnostics, prompts, Git diffs, or telemetry with the
request.

## Website

The AndSpace website is static. If the site is served through a hosting
provider, that provider may keep standard request/server logs as part of normal
hosting operations, such as IP address, user agent, requested URL, timestamp,
and error information.

## Sale Of Personal Data

AndSpace does not sell personal data.

## Questions

For privacy questions, use GitHub issues:
https://github.com/SetFodi/Andspace/issues

Do not post secrets, tokens, or private project content in public issues.
