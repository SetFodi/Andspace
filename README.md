# AndSpace — Phase 0 Prototype

Minimal macOS terminal built on Tauri 2 + Rust + xterm.js, used to validate
whether this stack can carry the eventual AndSpace product.

**This is not v0.1.** No Command Guard, no `ANDSPACE.md`, no AI handoff,
no sidebar. See `docs/PHASE_0.md` for what this is and isn't, and
`docs/BENCHMARKS.md` for the validation gate.

## Run

```bash
pnpm install
pnpm build          # one-time: populates dist/ so Tauri's macro is satisfied
pnpm tauri dev
```

First `pnpm tauri dev` compiles all Cargo deps (5–10 min). Subsequent runs
are fast. The `pnpm build` step is only needed once — `dist/` is gitignored
but Tauri's `generate_context!` macro validates it exists at compile time.

## Shortcuts

| Shortcut | Action |
|---|---|
| ⌘T | New tab |
| ⌘W | Close current pane (closes tab if it's the only pane) |
| ⌘→ | Split right |
| ⌘↓ | Split down |
| ⌘[ / ⌘] | Previous / next tab |
| ⌘1–⌘9 | Jump to tab N |

`⌘→` / `⌘↓` override macOS's default "move to end of line / scroll to
bottom" inside the AndSpace window. They're not intercepted globally —
they only affect AndSpace when it has focus.
