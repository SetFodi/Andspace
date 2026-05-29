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
  "workflow": {
    "defaultFileAction": "auto",
    "defaultAiCli": "ask",
    "serverOpenBehavior": "external"
  },
  "safety": {
    "workspaceRestoreEnabled": true,
    "commandGuardEnabled": true
  }
}
```

## First-Run Onboarding

On first launch, AndSpace shows a local welcome/preferences modal. It covers:

- Theme.
- Terminal font size.
- Scrollback profile.
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
Preferences` all open the same lightweight surface later.

## Applied Preferences

These preferences are active in this version:

| Preference | Behavior |
| --- | --- |
| Theme | Applies to app chrome and terminal color theme |
| Font size | Applies to existing and new terminal panes |
| Scrollback profile | Applies to existing and new terminal panes |
| Default file action | Used by `Cmd+Enter` file actions and Go to File defaults |
| Default AI CLI | Preferred handoff CLI is ordered/focused first in the `Cmd+E` overlay |
| Workspace restore | Controls automatic launch restore and autosave |
| Command Guard | Existing zsh panes read this local preference before each command |

## Deferred Preferences

The local server preference is stored as `external` today. AndSpace Preview is
shown as "coming next" and is not enabled yet. Server rows still open in the
external browser in this version.

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

See [PRIVACY.md](PRIVACY.md) and
[WORKSPACE_PERSISTENCE.md](WORKSPACE_PERSISTENCE.md).

## Diagnostics

Preferences load/save events are written to `/tmp/andspace-diag.log`:

```text
preferences-load result=ok path=...
preferences-load result=missing
preferences-load result=error error=...
preferences-save result=ok path=... onboarding_completed=true
```

## Tests

- Rust tests cover JSON round-trip, missing-field tolerance, and newer-version
  tolerance.
- `scripts/test-preferences.mjs` covers frontend defaults, normalization,
  scrollback profile mapping, and default file-action fallback behavior.
