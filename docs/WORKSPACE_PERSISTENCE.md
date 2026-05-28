# Workspace Persistence

AndSpace v0.1 remembers lightweight workspace shape between launches so the
app opens where the user left off without trying to become a terminal session
manager.

## Storage Location

Workspace state is stored locally at:

```text
~/Library/Application Support/AndSpace/workspace.json
```

The file is JSON, versioned, and best-effort tolerant of missing or older
fields.

## What Is Restored

- Window size and position, when available. If the saved position is no longer
  visible on an attached monitor, AndSpace clamps the window back onto the
  current display work area.
- Open tabs.
- Tab names.
- Pane split layout.
- Active tab.
- Active pane per tab.
- Last known cwd per pane.
- Sidebar open / closed state.
- Sidebar focused section.
- Fixed sidebar width (`256px`).
- Last project root, when available.

## What Is Not Restored

- Terminal scrollback.
- Command output.
- Running processes.
- Shell history.
- AI handoff prompts.
- Command Guard prompt contents.
- Server detection records.
- Secrets printed in the terminal.

On launch, restored panes start **fresh shell PTYs**. If a pane had a saved
cwd and that directory still exists, the shell starts there. If the directory
is gone, AndSpace falls back to the user's home directory.

Server rows are intentionally not restored. A server appears again only if a
fresh terminal process prints a local URL.

## Command Palette

`Cmd+K` includes:

| Action | Behavior |
| --- | --- |
| Restore Last Workspace | Reloads the saved workspace snapshot and recreates fresh shell panes |
| Reset Saved Workspace | Deletes `workspace.json`; the current live session is unchanged |

Reset affects the next launch. It does not close current tabs or kill current
processes.

## Diagnostics

Workspace events are written to `/tmp/andspace-diag.log`:

```text
workspace-load result=ok path=...
workspace-load result=missing
workspace-load result=error error=...
workspace-save result=ok path=... tabs=2 panes=4
workspace-restore-pane requested_cwd=/repo cwd=/repo result=ok
workspace-restore-pane requested_cwd=/missing cwd=/Users/name result=fallback-home
workspace-reset
```

## Format

Current shape:

```json
{
  "version": 1,
  "savedAt": 1779999999999,
  "activeTabId": "tab-1",
  "activePaneId": "pane-2",
  "activePaneByTab": {
    "tab-1": "pane-2"
  },
  "tabs": [
    {
      "id": "tab-1",
      "title": "shell",
      "root": {
        "kind": "split",
        "direction": "row",
        "a": { "kind": "pane", "paneId": "pane-1" },
        "b": { "kind": "pane", "paneId": "pane-2" }
      }
    }
  ],
  "panes": {
    "pane-1": { "cwd": "/repo" },
    "pane-2": { "cwd": "/repo/src" }
  },
  "sidebar": {
    "open": true,
    "focusedSection": "files",
    "width": 256
  },
  "projectRoot": "/repo",
  "window": {
    "x": 120,
    "y": 80,
    "width": 1400,
    "height": 900
  }
}
```

Pane ids in the file are snapshot ids only. On restore, AndSpace creates new
PTYs and remaps the split tree to the new live pane ids.

## Tests

- Rust tests cover JSON round-trip, missing-field tolerance, newer version
  tolerance, and missing cwd fallback.
- `scripts/test-workspace-persistence.mjs` covers the frontend model,
  privacy shape, split tree remapping, version tolerance, cwd fallback model,
  and off-screen window placement fallback.
