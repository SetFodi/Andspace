# Command Palette

`Cmd+K` opens the v0.1 command palette. It is a small keyboard-first overlay
for terminal workflow actions, not a dashboard, project explorer, file
explorer, or full settings app.

## Commands

| Section      | Title                | What it does                                |
| ------------ | -------------------- | ------------------------------------------- |
| Terminal     | New Tab              | Open a new tab                              |
| Terminal     | Split Right          | Split the active pane horizontally          |
| Terminal     | Split Down           | Split the active pane vertically            |
| Terminal     | Close Pane           | Close the active pane                       |
| Project      | Toggle Sidebar       | Open / close the project sidebar            |
| Project      | Focus Files          | Open the sidebar focused on the file tree   |
| Project      | Focus Scripts        | Open the sidebar focused on package scripts |
| Project      | Run Script           | Open the sidebar to pick a script to run    |
| Project      | Go to File           | Open the file picker over the project tree  |
| Project      | Create ANDSPACE.md   | Scaffold an ANDSPACE.md in the active pane  |
| AI / Handoff | Send Context         | Open the AI handoff overlay                 |
| AI / Handoff | Copy Last Prompt     | Copy the most recent handoff prompt         |
| Servers      | Open Localhost Preview | Open the most recent server in preview    |
| Servers      | Copy Server URL      | Copy the most recently detected server URL  |
| Servers      | Focus Servers        | Open the sidebar focused on Servers         |
| Git          | Focus Git Changes    | Open the sidebar focused on Git Changes     |
| Git          | Refresh Git Changes  | Refresh read-only Git status                |
| Git          | Open Git Diff        | Open a read-only diff for a changed file    |
| Git          | Copy Git Diff        | Copy the selected / first changed file diff |
| Git          | Open Changed File    | Open File Actions for the first changed file |
| Workspace    | Restore Last Workspace | Recreate tabs/splits/cwds from saved state |
| Workspace    | Reset Saved Workspace | Delete the saved workspace file             |
| Preferences  | Open Preferences      | Open lightweight local preferences          |
| Preferences  | Color Scheme          | Open the quick color scheme picker          |
| Help         | Keyboard Shortcuts   | Open the cheatsheet overlay                 |
| Help         | Check for Updates    | Manually check GitHub for the latest release |
| Help         | Copy Diagnostics     | Copy a sanitized support block for bug reports |

Filtering is simple substring matching over command title, section, id, and
keywords. Arrow keys move selection, Enter runs the selected action, and
Escape closes the palette.

## Overlay priority

Only one overlay is on screen at a time. From highest priority to lowest:

1. **Command Guard** confirmation — blocks all other overlays and all
   `Cmd`-shortcuts. Cannot be dismissed by another overlay opening.
2. **Preferences / first-run onboarding** (palette → "Open Preferences")
3. **Color Scheme** (`Cmd+P`)
4. **AI Handoff** (`Cmd+E`)
5. **Command Palette** (`Cmd+K`)
6. **Keyboard Shortcuts** (`Cmd+/`)
7. **File Actions** (sidebar click / Enter)
8. **Go to File** (palette → "Go to File")

While any overlay is open, all `Cmd`-shortcuts are ignored so users can't
stack overlays. Each overlay owns its own window-level Escape handler that
closes itself and returns focus to the active terminal pane.

## Diagnostics

Diagnostics are written to `/tmp/andspace-diag.log`:

```text
command-palette-open
command-palette-run action=terminal.splitRight
command-palette-run action=workspace.restore
command-palette-run action=git.refresh
command-palette-run action=help.checkUpdates
command-palette-run action=help.copyDiagnostics
```

`Copy Diagnostics` copies app version, macOS version, architecture, renderer,
shell integration status, active cwd, preferences path, workspace path,
diagnostics log path, and install method when known. It does not copy terminal
output, command history, AI prompts, secrets, Git diffs, shell history, or
environment variable values.

`Check for Updates` is manual and user-triggered. It contacts GitHub releases
only when selected, compares the latest release tag to the current app version,
and opens the GitHub release page if the user chooses. It does not auto-install
updates, run in the background, send diagnostics, or send telemetry.

## Limits

- The palette stays lightweight; it should not become a dashboard.
- Sidebar commands only focus or toggle Files / Scripts / Servers / Git Changes.
- Git Changes actions are read-only: status, diff preview, copy diff, and
  external File Actions only. There is no commit, push, pull, staging, reset,
  checkout, stash, merge, or rebase action.
- No full settings app; Preferences is a compact local onboarding/preferences
  surface.
- Local Preview is scoped to detected localhost/private-LAN server URLs only;
  it is not a general browser.
- Workspace commands restore layout and cwd only; they do not restore
  scrollback, output, prompts, or old processes.
