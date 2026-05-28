# Servers

The v0.1 Servers section lists local development servers AndSpace has noticed
in **terminal output**. It is a small terminal companion — not a browser, not
a service monitor, not a tunnel manager.

## What gets detected

When PTY output flows through AndSpace, the renderer scans each chunk for
local URLs:

- `http://localhost:PORT`
- `http://127.0.0.1:PORT`
- `http://0.0.0.0:PORT`
- `http://192.168.X.X:PORT` (and other RFC 1918 LAN ranges: `10.x.x.x`,
  `172.16.x.x` – `172.31.x.x`)
- `https://...` variants of all of the above

ANSI color sequences are stripped before matching, so a colored `Local:`
banner from Vite/Next won't break detection.

**Detection is best-effort.** A server that never prints its URL (e.g. a
silent daemon, a CLI tool that only writes to a status file) will not show
up. There is no port scan, no `/health` poll, no `netstat` walk.

## What does **not** happen

- No background port scanning.
- No periodic polling.
- No HTTP/HTTPS health checks.
- No `fetch()` calls to detected URLs.
- No persistent storage — the list lives in memory and is dropped on quit.
- No watcher process on the host.

If terminal output doesn't mention a URL, AndSpace has no opinion about it.

## Labels

Each detected URL gets a best-effort framework label:

| Label      | When                                                                |
| ---------- | ------------------------------------------------------------------- |
| Next.js    | `Next.js`, `▲ Next` or similar banner in the recent output buffer   |
| Vite       | `VITE` banner, or port 5173                                         |
| Astro      | `astro` banner, or port 4321                                        |
| NestJS     | `Nest application` banner                                           |
| Remix      | `remix` banner                                                      |
| SvelteKit  | `svelte` or `sveltekit` banner                                      |
| Storybook  | `storybook` banner, or port 6006                                    |
| API        | URL path contains `/api` or `/graphql`                              |
| Local      | Anything else                                                       |

Labels are inferred from a rolling **4 KB context buffer** of recent text
near the URL — they're hints, not promises.

## Sidebar

The Servers section sits below Files + Scripts. When empty it shows a single
quiet hint line. When populated, each row renders as:

```
●  Vite       localhost:5173
●  Next.js    localhost:3000
●  API        localhost:3001
```

A subtle green dot signals "I saw this URL in terminal output". It is **not**
a live health indicator — AndSpace doesn't ping the server.

Row actions:

- **Click** → open the URL in your default browser (`open <url>` on macOS).
- **Right-click** or **⌘C while focused** → copy the URL to the clipboard.

## Command Palette

`⌘K` includes three server actions, disabled when no servers are known:

| Action                  | Behavior                                          |
| ----------------------- | ------------------------------------------------- |
| Open Localhost Preview  | Opens the most recently seen server in browser    |
| Copy Server URL         | Copies the most recently seen server URL          |
| Focus Servers           | Opens the sidebar focused on the Servers section  |

"Most recent" is sorted by `lastSeenAt`. If multiple servers are running, use
the sidebar to pick a specific one.

## Lifecycle

- Detection is **per pane**. When a pane closes, its servers are removed
  from the list.
- The list is capped at **16 servers** in memory. Hitting the cap drops the
  oldest entries; in practice you'll never reach this.
- Duplicate URLs only update `lastSeenAt` — they don't grow the list.

## Diagnostics

Each event is logged to `/tmp/andspace-diag.log`:

```text
server-detected url=http://localhost:5173 pane=pane-abc label=Vite
server-open url=http://localhost:5173
server-copy url=http://localhost:5173
server-duplicate-ignored url=http://localhost:5173
server-section-empty
```

## Tests

`scripts/test-server-detection.mjs` is a tiny standalone Node script that
exercises the URL parser, dedup, label inference, and ANSI stripping. Run
it directly (requires Node 22.6+ for native TypeScript strip):

```sh
./scripts/test-server-detection.mjs
```

## Out of scope (deferred)

- Embedded browser preview tab.
- Custom port labels.
- Per-server tunnel/share (ngrok, Cloudflare).
- Health checks / status pings.
- Reading from `lsof -i` or `netstat`.
- Settings UI.
