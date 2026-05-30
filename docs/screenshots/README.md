# v0.1.0-alpha.9 Screenshot Capture Status

Final screenshots were captured from the packaged macOS app. If any asset needs
to be refreshed, use this plan and keep the same filenames.

Use the built app:

```text
src-tauri/target/release/bundle/macos/AndSpace.app
```

Final captures should be saved in:

```text
docs/screenshots/final/
```

## Final Screenshot States

| File | State To Capture |
| --- | --- |
| `01-hero-sidebar.png` | Main AndSpace window with the sidebar open, Files / Scripts / Servers / Git Changes visible, and split terminal panes. Use a non-sensitive project name and terminal output. |
| `02-command-guard.png` | Command Guard overlay blocking a protected or dangerous command, with the command text and confirmation affordance visible. |
| `03-ai-handoff.png` | `Cmd+E` Send Context overlay with Preview, Copy, Claude, Codex, and Cursor actions visible. |
| `04-command-palette.png` | `Cmd+K` command palette open with a few core commands visible, such as New Tab, Split Right, Toggle Sidebar, and Keyboard Shortcuts. |
| `05-git-diff-preview.png` | Git Changes section visible with a changed tracked file selected and the read-only Git Diff Preview overlay open. |
| `06-servers.png` | Servers section showing a detected localhost URL from terminal output, ideally with the dev server command visible in the terminal. |
| `07-keyboard-shortcuts.png` | `Cmd+/` keyboard shortcuts overlay open, showing the final v0.1 shortcut scheme. |

## Manual Capture Setup

- Use a real local project with at least one modified tracked file.
- Run a dev server (`pnpm dev`, `npm run dev`, or `bun dev`) for the Servers
  screenshot.
- Create at least two panes so pane borders and focus state are visible.
- Use `Cmd+B` to keep the sidebar open for sidebar-focused shots.
- Use `Cmd+K`, `Cmd+E`, and `Cmd+/` for overlay shots instead of opening them
  through developer tools.
- Keep screenshots free of secrets, tokens, private repo names, and sensitive
  terminal output.
- Prefer the packaged app, not `pnpm tauri dev`.

## Capture Commands

If macOS Screen Recording permission is available, capture the AndSpace window
after staging each state:

```bash
screencapture -i -w docs/screenshots/final/01-hero-sidebar.png
```

Then click the AndSpace window. If the command cannot access the window because
macOS permissions are blocked, use the built-in screenshot UI:

1. Press `Cmd+Shift+5`.
2. Choose "Capture Selected Window".
3. Click the AndSpace window.
4. Save the image into `docs/screenshots/final/`.
5. Rename it to the matching filename from the table above.

## Capture Status

| File | Status |
| --- | --- |
| `01-hero-sidebar.png` | Captured from packaged app |
| `02-command-guard.png` | Captured from packaged app |
| `03-ai-handoff.png` | Captured from packaged app |
| `04-command-palette.png` | Captured from packaged app |
| `05-git-diff-preview.png` | Captured from packaged app |
| `06-servers.png` | Captured from packaged app |
| `07-keyboard-shortcuts.png` | Captured from packaged app |

All captures use the production app UI, a temporary non-sensitive demo project,
and a consistent wide desktop window.
