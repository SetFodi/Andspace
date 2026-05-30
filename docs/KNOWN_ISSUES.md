# Known Issues

AndSpace `v0.1.0-alpha.7` is a public prerelease alpha. This document keeps
current limits visible so testers know what is expected behavior and what is
worth reporting.

## Current Alpha Limits

- **Unsigned prerelease alpha.** macOS may require right-click -> Open or
  approval from System Settings -> Privacy & Security on first launch.
- **macOS-first.** The packaged public build targets macOS, with Apple Silicon
  as the primary focus.
- **zsh-first shell integration.** Bash/fish placeholders exist, but the
  polished shell integration and Command Guard path are zsh-first today.
- **Browser Preview is local-dev focused.** Local Preview is limited to
  localhost/private-LAN HTTP(S) URLs. It is not a full browser, has no address
  bar, no browsing history, and no devtools.
- **Raw sustained output is not Ghostty-class yet.** AndSpace is tuned for
  normal local development and workflow ergonomics. Very large output floods
  can still be slower than native GPU terminals.
- **No Git write actions.** Git Changes and Git Diff Preview are read-only:
  no stage, commit, push, pull, reset, checkout, stash, merge, or rebase UI.
- **No built-in editor.** File Actions hand off to installed tools such as
  Cursor, VS Code, Neovim, Finder, or clipboard.
- **No provider API integration.** AI Handoff uses locally installed Claude
  Code, Codex, or Cursor CLI only. There is no hosted AI backend and no hidden
  provider API billing.
- **Local AI CLIs only.** If a CLI is not installed or cannot be resolved from
  the app environment, the related handoff action may be unavailable.

## Good Alpha Feedback

Please report bugs that affect real daily terminal use:

- Focus gets stuck or returns to the wrong pane.
- Local Preview opens the wrong URL or fails for a normal localhost app.
- Command Guard blocks a safe command or misses an obviously risky one.
- Workspace restore brings back wrong tabs, split layout, or cwd.
- Sidebar Files, Scripts, Servers, or Git Changes follow the wrong pane.
- AI handoff launches from the wrong cwd or exposes unexpected prompt content.
- Install, checksum, launch, or unsigned-alpha instructions are unclear.

Use **Cmd+K -> Copy Diagnostics** and remove anything sensitive before sharing.
