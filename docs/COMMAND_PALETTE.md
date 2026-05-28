# Command Palette

`Cmd+K` opens the v0.1 command palette. It is a small keyboard-first overlay for
terminal workflow actions, not a sidebar, project explorer, file explorer, or
settings UI.

## Commands

Initial actions:

- `New Tab`
- `Split Right`
- `Split Down`
- `Close Pane`
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

- No sidebar.
- No file explorer.
- No Git panel.
- No settings UI.
- No server detection.
