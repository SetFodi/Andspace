# Preferences

AndSpace has a lightweight first-run onboarding flow and a compact Preferences
modal. This is intentionally not a full settings app; it only covers defaults
that matter before public launch.

## Storage Location

Preferences are stored locally at:

```text
~/Library/Application Support/AndSpace/preferences.json
```

The file is JSON, versioned, and tolerant of missing or older fields.

## Stored Values

Current preference shape:

```json
{
  "version": 1,
  "savedAt": 1779999999999,
  "onboardingCompleted": true,
  "theme": "graphite-violet",
  "terminal": {
    "fontSize": 13,
    "scrollbackProfile": "balanced"
  },
  "shell": {
    "profile": "user-shell",
    "customPath": null
  },
  "workflow": {
    "defaultFileAction": "auto",
    "defaultAiCli": "ask",
    "serverOpenBehavior": "preview"
  },
  "safety": {
    "workspaceRestoreEnabled": true,
    "commandGuardEnabled": true
  }
}
```

## First-Run Onboarding

On first launch, AndSpace shows a local welcome/preferences modal. It covers:

- Theme. AndSpace currently includes ten local color schemes.
- Terminal font size.
- Scrollback profile.
- Shell profile.
- Default file action.
- Default AI CLI target.
- Local server open behavior.
- Command Guard.
- Workspace restore.

The onboarding copy is intentionally local-first:

- No account required.
- No telemetry.
- Local AI CLIs only.
- Workspace restore stores layout and cwd, not terminal output or prompts.

After the user chooses **Start using AndSpace**, `onboardingCompleted` is set to
`true` and the first-run modal does not appear again. The native macOS
**AndSpace -> Preferences...** menu item, `Cmd+,`, and `Cmd+K -> Open
Preferences` all open the same lightweight surface later. `Cmd+P` opens a
focused color scheme picker for quick theme changes.

On first launch, AndSpace waits to create the first PTY until onboarding is
complete. That keeps the first pane aligned with the shell profile the user
chooses.

## Shell Profiles

AndSpace supports three shell profile choices:

| Profile | Behavior |
| --- | --- |
| Managed zsh profile | Recommended. Starts `/bin/zsh` with AndSpace's managed `ZDOTDIR`, clean prompt, AndSpace shell integration, and optional recommended tools. It does not source or modify the user's personal dotfiles. |
| Use my shell config | Uses the user's existing `$SHELL` and personal zsh dotfiles when the shell is zsh. This preserves customized setups and matches earlier alpha behavior. |
| Custom shell path | Starts a specific shell executable. If the path is invalid, AndSpace falls back to the user's shell. |

The managed profile can enable these tools when they are already installed:

- `zoxide`
- `zsh-autosuggestions`
- `zsh-syntax-highlighting`
- `fzf`
- `eza`

If Homebrew is available, the Preferences modal can install missing recommended
tools after the user clicks **Install missing**. AndSpace does not install
shell tools silently and does not edit `~/.zshrc`, `~/.zprofile`, or
`~/.zshenv`.

## Applied Preferences

These preferences are active in this version:

| Preference | Behavior |
| --- | --- |
| Theme | Applies to app chrome and terminal color theme |
| Font size | Applies to existing and new terminal panes |
| Scrollback profile | Applies to existing and new terminal panes |
| Shell profile | Applies to newly created panes |
| Default file action | Used by `Cmd+Enter` file actions and Go to File defaults |
| Default AI CLI | Preferred handoff CLI is ordered/focused first in the `Cmd+E` overlay |
| Server links | Optional escape hatch to open server rows in the external browser instead of Preview |
| Workspace restore | Controls automatic launch restore and autosave |
| Command Guard | Existing zsh panes read this local preference before each command |

## Deferred Preferences

The `ask` value is reserved for a future prompt flow and normalizes back to
the default today. Terminal links use modifiers directly: `Cmd+click` opens
local URLs in AndSpace Preview, while `Cmd+Shift+click` opens them in the
external browser.

## Scrollback Profiles

| Profile | Retained rows |
| --- | ---: |
| Memory saver | 1,000 |
| Balanced | 5,000 |
| Long history | 15,000 |

Scrollback affects live xterm retention only. It is not persisted across app
launches.

## Privacy

Preferences do not store:

- Terminal scrollback.
- Command output.
- AI prompt contents.
- Secrets.
- Git diffs.
- Command history.
- Shell history.
- Server records.
- Personal shell config contents.

See [PRIVACY.md](PRIVACY.md) and
[WORKSPACE_PERSISTENCE.md](WORKSPACE_PERSISTENCE.md).

## Diagnostics

Preferences load/save events are written to `/tmp/andspace-diag.log`:

```text
preferences-load result=ok path=...
preferences-load result=missing
preferences-load result=error error=...
preferences-save result=ok path=... onboarding_completed=true
shell-setup-detect
shell-tools-install result=ok packages=...
```

## Tests

- Rust tests cover JSON round-trip, missing-field tolerance, and newer-version
  tolerance.
- `scripts/test-preferences.mjs` covers frontend defaults, normalization,
  scrollback profile mapping, and default file-action fallback behavior.
