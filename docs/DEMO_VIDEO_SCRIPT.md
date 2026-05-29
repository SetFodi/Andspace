# AndSpace v0.1.0-alpha.3 Demo Video Script

Target length: 30-45 seconds.

Tone: calm, premium, no hype text on screen. Let the app carry the demo.

## Setup

- Use the packaged app, not dev mode.
- Use a non-sensitive local project with:
  - a `package.json` dev script
  - one modified tracked file
  - an `ANDSPACE.md` rule that protects a harmless command for the demo
- Keep the sidebar open for the first and final shot.
- Hide notifications and unrelated apps.

## Flow

| Time | Shot | Action |
| --- | --- | --- |
| 0-4s | Restored workspace | Open AndSpace into a restored workspace with sidebar, two panes, and a clean prompt. |
| 4-9s | Terminal-first work | Run `pnpm dev` in one pane. Keep the command readable and avoid long output. |
| 9-13s | Servers | Show the Servers section detecting `localhost`. Click the server row to open it in the browser, then return to AndSpace. |
| 13-17s | Command palette | Press `Cmd+K`, type a short query like `split` or `git`, then close with Escape. |
| 17-23s | Command Guard | Run the protected demo command and show Command Guard blocking it. Close or confirm intentionally. |
| 23-29s | AI handoff | Press `Cmd+E` and show the Send Context overlay with Preview, Copy, Claude, Codex, and Cursor actions. |
| 29-37s | Git Changes + Diff | Focus Git Changes, open a changed file, and show the read-only Git Diff Preview. |
| 37-45s | Hero ending | Return to the main app state: sidebar open, split panes visible, terminal focused. |

## Voiceover Option

"AndSpace is a terminal-first workspace for local development. It restores your
tabs and panes, keeps project files, scripts, servers, and Git changes close by,
guards risky commands, and hands context to your local AI CLIs without provider
API billing. This is v0.1 alpha for macOS."

## Capture Notes

- Record at 16:9, preferably 1920x1080 or 2560x1440.
- Keep terminal font large enough to read after compression.
- Avoid showing private repository names, tokens, shell history, or real customer
  code.
- Do not show staging, committing, pushing, settings, browser preview, or file
  editing because those are intentionally not part of this alpha.
