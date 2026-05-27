# Phase 0 — Terminal Foundation Validation

## What this prototype is

A minimal macOS terminal built on **Tauri 2 + Rust + xterm.js**. It exists to
answer one question:

> Can this stack carry a terminal-first product, or do we need a native
> renderer for v0.1?

It is **not** AndSpace v0.1. It has no Command Guard, no `ANDSPACE.md`, no AI
CLI handoff, no sidebar, no command palette. Those features belong to v0.1
and will be designed against this stack only if Phase 0 passes the benchmark
gate in `BENCHMARKS.md`.

## What's in scope

- Tauri 2 + Rust backend with PTY management via `portable-pty`
- React + TypeScript frontend
- xterm.js terminal with WebGL renderer (DOM fallback if WebGL fails)
- Tabs (⌘T new, ⌘W close, ⌘[ / ⌘] cycle, ⌘1–⌘9 jump)
- Horizontal split (⌘D split right) and vertical split (⌘⇧D split down)
- Per-pane PTY processes
- Resize propagation from UI to PTY
- Default shell from `$SHELL`
- Single dark theme (deep graphite + violet accent)

## What's explicitly out of scope

Anything not in the list above. Do not add product features in Phase 0.

- Sidebar, command palette, Quick Actions
- AI CLI handoff (⌘E)
- `ANDSPACE.md` parser
- Command Guard
- Git / server detection
- File explorer or preview
- Multiple themes, settings UI
- Session persistence to disk
- App signing, notarization, auto-update
- Linux or Windows support

## How to run

```bash
pnpm install
pnpm build          # one-time: populates dist/
pnpm tauri dev
```

The first `pnpm tauri dev` compiles all Cargo dependencies (5–10 minutes).
Subsequent runs are incremental.

The one-time `pnpm build` is needed because Tauri 2's `generate_context!`
macro validates that `frontendDist` (`../dist`) exists at Rust compile time.
`dist/` is gitignored, so after a fresh clone you need to populate it once.
In dev mode Tauri uses `devUrl` (the vite dev server at `localhost:1420`),
not `dist/` — the directory just has to exist.

## Architecture notes

### PTY lifecycle
`src-tauri/src/pty.rs` owns a `PtyManager` (held as Tauri state) wrapping
`HashMap<PaneId, PtyHandle>`. Each handle owns the master pty, the writer,
and the child process. A blocking reader thread per pane forwards bytes to
the frontend via the `pty-output` event. On EOF, the thread emits
`pty-exit` and removes itself from the map.

### Tauri commands (`src-tauri/src/commands.rs`)
- `create_pty(cols, rows) -> PaneId`
- `write_to_pty(pane_id, data)` — UTF-8 string from `term.onData`
- `resize_pty(pane_id, cols, rows)`
- `kill_pty(pane_id)`

### IPC encoding (known concern)
PTY output is sent as `Vec<u8>` inside a JSON payload. This is simple but
not optimal — JSON-serializing a byte array adds substantial overhead.
**If the `yes hello` throughput benchmark fails (Test #5 in
`BENCHMARKS.md`), the recommended fix is migrating to
`tauri::ipc::Channel<Vec<u8>>` for binary IPC.** This is a known
optimization path, not a stack rejection.

### Frontend state
`src/terminal/terminalStore.ts` uses Zustand. Tabs are an array; each tab
holds a binary `SplitNode` tree representing splits. Rendering recurses
through the tree (`SplitTree.tsx`).

### Renderer
The WebGL addon is loaded **after** `term.open()` with a `try/catch`
fallback to xterm's default (DOM) renderer. The fallback should not
trigger on modern macOS WebKit; the safety net is there for headless or
unusual GPU configurations.

### Keyboard
`App.tsx` listens on `window` for ⌘-modified keys and dispatches to the
store. `TerminalPane.tsx` uses `term.attachCustomKeyEventHandler` to
prevent those same shortcuts from being forwarded into the shell.

## Decision gate

After running every test in `BENCHMARKS.md`, count results:

| Result distribution | Decision |
|---|---|
| ≥ 70% in target/acceptable, ≤ 2 fails | **Approved** → proceed to v0.1 |
| 50–69% acceptable, 3–5 fails | **Conditional** → ship, but lock "workflow-first" positioning publicly (drop any Ghostty comparison) |
| < 50% acceptable or > 5 fails | **Rejected** → pivot to native Swift + Metal + Rust PTY |

Record the decision in `STACK_DECISION.md` at the repo root.

## What "honest verdict" means

The author of the prototype should write one paragraph at the end of
`STACK_DECISION.md` answering, plainly:

- Did it *feel* like a tool you'd use daily?
- Where did you flinch?
- What specifically would you tell a Ghostty user to expect?

Numbers tell you what; the verdict tells you whether.
