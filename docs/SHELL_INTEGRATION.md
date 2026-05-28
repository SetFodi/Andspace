# Shell Integration

AndSpace learns shell state via **OSC sequences** emitted from zsh hooks.
The terminal consumes them in xterm.js before rendering; they never appear
on screen.

## Bootstrap strategy (v0.1 milestone 2)

AndSpace does **not** modify `~/.zshrc` or any file in the user's home
directory. Instead, when the PTY spawns **zsh**, Rust sets:

| Variable | Purpose |
|---|---|
| `ZDOTDIR` | Points at `src-tauri/shell-integration/zdotdir/` |
| `TERM_PROGRAM` | `AndSpace` — guards integration to this app only |
| `ANDSPACE_PANE_ID` | Pane id for shell-side diagnostics |
| `ANDSPACE_ZSH_INTEGRATION` | Path to `andspace.zsh` |
| `ANDSPACE_ZDOTDIR` | Same as `ZDOTDIR` (diagnostic / future use) |

zsh reads **`$ZDOTDIR/.zshenv`** then **`$ZDOTDIR/.zshrc`** instead of the
user's `~/.zshenv` / `~/.zshrc` paths directly. Our bootstrap files:

1. Source the user's real `~/.zshenv` / `~/.zshrc` if they exist on disk (prompt, zle, aliases).
2. Source `andspace.zsh` (OSC hooks — after zle is available).

The user's on-disk config is **read-only sourced**, never written. Aliases,
prompt, and plugins from `~/.zshrc` still load after integration hooks
register.

Non-zsh shells (`bash`, `fish`) are unchanged — no `ZDOTDIR` override.

### Why not edit `~/.zshrc` yet?

- Avoid surprising global shell changes outside AndSpace.
- Avoid installer/diff complexity before Command Guard needs it.
- `ZDOTDIR` is the standard zsh mechanism for isolated startup files.

A future milestone may offer optional user-level install; v0.1 uses PTY-only
bootstrap.

zsh must not write completion caches into `zdotdir/` (that path is under
`src-tauri/` and would retrigger `tauri dev` rebuilds). `.zshenv` redirects
`ZSH_COMPDUMP` and `HISTFILE` to `/tmp`. `src-tauri/.taurignore` excludes
`shell-integration/zdotdir/` from the dev watcher as a safety net.

## Files

| File | Role |
|---|---|
| `src-tauri/shell-integration/andspace.zsh` | zsh `precmd` / `preexec` OSC hooks and `accept-line` Command Guard gate |
| `src-tauri/shell-integration/zdotdir/.zshenv` | Bootstrap → user's `~/.zshenv` |
| `src-tauri/shell-integration/zdotdir/.zshrc` | Bootstrap → user's `~/.zshrc` → `andspace.zsh` |
| `src-tauri/shell-integration/bash.placeholder` | Not implemented |
| `src-tauri/shell-integration/fish.placeholder` | Not implemented |
| `src/terminal/shellIntegration.ts` | OSC parsers + xterm handler registration |
| `src/terminal/terminalStore.ts` | `paneMeta`, `commandHistoryByPane` |

## Environment (set on PTY spawn)

| Variable | Value |
|---|---|
| `TERM_PROGRAM` | `AndSpace` |
| `ANDSPACE_SHELL_INTEGRATION` | `1` |
| `ANDSPACE_PANE_ID` | Pane id (`p-…`) |
| `ANDSPACE_ZSH_INTEGRATION` | Absolute path to `andspace.zsh` (zsh only) |
| `ZDOTDIR` | Absolute path to `zdotdir/` (zsh only) |

## zsh Command Guard Gate

Milestone 5 installs an `accept-line` ZLE wrapper for zsh only. The wrapper
checks the current `$BUFFER` before zsh executes it:

- safe and allowed commands call the original `accept-line` widget immediately
- protected commands emit an OSC confirmation request and wait for the native UI
- dangerous commands emit an OSC confirmation request and require exact `run` in the native UI
- canceled commands clear `$BUFFER` and do not execute

The gate uses a temporary shell-side matcher that reads `./ANDSPACE.md`,
`~/.andspace/rules.md`, and built-in defaults. It mirrors the Rust evaluator's
matching order: allowed, dangerous, protected. A later bridge should move this
synchronous decision back to Rust.

The UI bridge is intentionally small: zsh emits OSC 9001 `guard-request`, the
frontend shows the overlay, Rust writes `/tmp/andspace-guard-<request>.response`,
and zsh polls that file. Missing or late responses default to cancel.

## OSC protocol

### OSC 7 — current working directory (standard)

```
ESC ] 7 ; file://HOST/PATH BEL
```

Also mirrored on AndSpace OSC 9001 as `cwd|<base64-path>`.

### OSC 9001 — AndSpace lifecycle (private)

Terminator: `ESC \` (ST). Payload is pipe-separated:

| Payload | Meaning |
|---|---|
| `cwd\|<b64>` | Working directory (UTF-8 path, base64) |
| `start\|<unix_s>` | Command started |
| `cmd\|<b64>` | Command line text (UTF-8, base64) |
| `end\|<exit>\|<unix_s>` | Command finished with exit code |
| `guard-request\|...` | Pre-execution Command Guard UI request |

zsh order per command: `start` → `cmd` → … run … → `end` (in next `precmd`).

## Frontend state

Per pane (`paneId` from Rust):

**`paneMeta`** — cwd, last command, exit code, output boundary, timestamps.

**`commandHistoryByPane`** — up to 50 entries per pane.

## Diagnostics

On zsh PTY create:

```
<ms> shell-autoload pane=p-… integration=/…/andspace.zsh zdotdir=/…/zdotdir
```

Each OSC event:

```
<ms> shell pane=p-abc osc kind=start boundary=42 ...
```

Each pre-execution Command Guard decision:

```
<ms> command-guard-preexec pane=p-abc cwd=/repo decision=protected severity=confirm matched_rule=echo protected-test matched_source=project matched_pattern_type=substring command=echo protected-test action=cancel
```

Each native UI request/action:

```
<ms> command-guard-ui-request pane=p-abc request_id=p-... decision=protected severity=confirm matched_rule=echo protected-test matched_source=project command=echo protected-test
<ms> command-guard-ui-action pane=p-abc request_id=p-... decision=protected action=run matched_rule=echo protected-test matched_source=project command=echo protected-test
```

## Verification

1. Launch AndSpace once (`pnpm tauri dev` or the release app). Do **not** leave
   a hot-reload dev session running while editing Rust — each rebuild respawns
   the app and creates new PTYs.
2. Open one tab. Do **not** run `source` manually.
3. Run `pwd`, `echo hello`, `false`.
4. Check diagnostics:

```bash
grep -E 'shell-autoload|kind=' /tmp/andspace-diag.log | tail -20
```

Expect `shell-autoload pane=…` on PTY create, then `kind=cwd`, `kind=start`,
`kind=cmd`, `kind=end` with `exit=0` and `exit=1`.

## Limitations (v0.1)

- zsh only; bash/fish are placeholders.
- Command Guard pre-execution blocking is zsh only.
- Login-only files (`~/.zprofile`, `~/.zlogin`) are not chained yet unless
  added to `zdotdir/` in a later milestone.
- Output boundary is a buffer **line index**, not byte offset.
- OSC 7 cwd parsing on `file://hostname/path` URLs may truncate on some hosts;
  OSC 9001 `cwd|base64` is authoritative.
- Aliases, shell expansion, scripts, and Makefiles can hide commands from the
  simple pre-execution matcher. Command Guard is a safety rail, not a security
  boundary.
- Dangerous commands default to cancel if the UI bridge fails or times out.
