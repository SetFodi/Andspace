# v0.1.0-alpha.2 Screenshot Checklist

Automatic screenshot capture is optional. If UI automation is blocked by macOS
Accessibility, capture these manually from the packaged app.

Use the built app:

```text
src-tauri/target/release/bundle/macos/AndSpace.app
```

Recommended filenames and exact states:

| File | State To Capture |
| --- | --- |
| `01-hero-terminal-sidebar.png` | Production app open with the sidebar visible, two terminal panes, Files / Scripts / Servers / Git Changes in view, and no private project names or secrets. |
| `02-command-guard.png` | Command Guard overlay open for a protected or dangerous command, showing the command and confirmation affordance. |
| `03-ai-handoff.png` | `Cmd+E` handoff overlay open with a recent terminal command available and the preview/copy/send controls visible. |
| `04-command-palette.png` | `Cmd+K` command palette open with a few core commands visible, such as New Tab, Split Right, Toggle Sidebar, and Keyboard Shortcuts. |
| `05-git-diff-preview.png` | Git Changes section visible with a changed tracked file selected and the read-only Git Diff Preview overlay open. |
| `06-servers-localhost.png` | A dev server running in the terminal and the Servers section showing the detected localhost URL. |
| `07-keyboard-shortcuts.png` | `Cmd+/` keyboard shortcuts overlay open, showing the final v0.1 shortcut scheme. |

Manual capture notes:

- Use a real local project with at least one modified tracked file.
- Run a dev server (`pnpm dev`, `npm run dev`, or `bun dev`) for the Servers
  screenshot.
- Keep screenshots free of secrets, tokens, private repo names, and sensitive
  terminal output.
- Prefer the packaged app, not `pnpm tauri dev`.
