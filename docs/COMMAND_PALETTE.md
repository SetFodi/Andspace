# Command Palette

`Cmd+K` opens the v0.1 command palette. It is a small keyboard-first overlay for
terminal workflow actions, not a dashboard, project explorer, file explorer, or
settings UI.

## Commands

Initial actions:

- `New Tab`
- `Split Right`
- `Split Down`
- `Close Pane`
- `Toggle Sidebar`
- `Focus Files`
- `Focus Scripts`
- `Run Script`
- `Create ANDSPACE.md`
- `Send Context`
- `Copy Last Prompt`
- `Test Protected Command`

Filtering is simple substring matching over command title, section, id, and
keywords. Arrow keys move selection, Enter runs the selected action, and Escape
closes the palette.

## Overlay Priority

Overlay priority is:

1. Command Guard confirmation
2. `Cmd+E` handoff
3. `Cmd+K` command palette

If Command Guard is open, the palette cannot take focus. If handoff is open, the
palette stays closed. Overlays stop keyboard events so accidental input does not
reach the terminal.

## Diagnostics

Diagnostics are written to `/tmp/andspace-diag.log`:

```text
command-palette-open
command-palette-run action=terminal.splitRight
```

## Limits

- The palette stays lightweight; it should not become a dashboard.
- Sidebar commands only focus or toggle the Files/Scripts sidebar.
- No Git panel.
- No settings UI.
- No server detection.
