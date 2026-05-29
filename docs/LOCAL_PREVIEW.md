# Local Preview

AndSpace can show a detected local development server in a right-side preview
panel. It is intentionally scoped to local dev URLs only; it is not a general
browser.

## What opens in preview

Preview accepts URLs AndSpace detected from terminal output:

- `localhost`
- `127.0.0.1`
- `0.0.0.0` (normalized to `localhost`)
- private LAN hosts: `10.x.x.x`, `172.16.x.x` through `172.31.x.x`,
  `192.168.x.x`

Only `http` and `https` URLs are allowed. Public websites and non-web
protocols are rejected.

## How to open

- Click a server row in the **Servers** section. By default, server rows open
  in AndSpace Preview.
- `Cmd+click` a local URL in a terminal pane opens it in AndSpace Preview.
- `Cmd+Shift+click` a local URL in a terminal pane opens it in the external
  browser.
- `Cmd+K -> Open Localhost Preview` opens the most recently detected server.
- If the window is too narrow, AndSpace opens the server in the external
  browser instead.

The preview toolbar includes:

- Local preview tabs for switching between opened dev URLs
- Refresh
- Open in browser
- Close

The preview panel is resizable from its left edge.

## Preferences

`Cmd+, -> Preferences` includes one server-link escape hatch:

- **Open server rows in external browser**: when enabled, sidebar server rows
  use the default browser instead of the preview panel.

Terminal link modifiers still win: `Cmd+click` previews local links and
`Cmd+Shift+click` opens them in the browser.

## Limits

- No arbitrary web browsing.
- One preview panel with lightweight local preview tabs.
- No browser history, address bar, devtools, or arbitrary browsing.
- No background health checks or server polling.
- Some local apps may block iframe embedding; use **Open in browser** when
  that happens.
