# Command Palette

`Cmd+K` opens the v0.1 command palette. It is a small keyboard-first overlay
for terminal workflow actions, not a dashboard, project explorer, file
explorer, or settings UI.

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
| Servers      | Open Localhost Preview | Open the most recently detected server    |
| Servers      | Copy Server URL      | Copy the most recently detected server URL  |
| Servers      | Focus Servers        | Open the sidebar focused on Servers         |
| Help         | Keyboard Shortcuts   | Open the cheatsheet overlay                 |

Filtering is simple substring matching over command title, section, id, and
keywords. Arrow keys move selection, Enter runs the selected action, and
Escape closes the palette.

## Overlay priority

Only one overlay is on screen at a time. From highest priority to lowest:

1. **Command Guard** confirmation — blocks all other overlays and all
   `Cmd`-shortcuts. Cannot be dismissed by another overlay opening.
2. **AI Handoff** (`Cmd+E`)
3. **Command Palette** (`Cmd+K`)
4. **Keyboard Shortcuts** (`Cmd+/`)
5. **File Actions** (sidebar click / Enter)
6. **Go to File** (palette → "Go to File")

While any overlay is open, all `Cmd`-shortcuts are ignored so users can't
stack overlays. Each overlay owns its own window-level Escape handler that
closes itself and returns focus to the active terminal pane.

## Diagnostics

Diagnostics are written to `/tmp/andspace-diag.log`:

```text
command-palette-open
command-palette-run action=terminal.splitRight
```

## Limits

- The palette stays lightweight; it should not become a dashboard.
- Sidebar commands only focus or toggle Files / Scripts / Servers.
- No Git panel.
- No settings UI.
- No embedded browser preview.
