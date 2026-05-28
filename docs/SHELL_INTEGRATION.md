# Shell Integration

AndSpace learns shell state via **OSC sequences** emitted from zsh hooks.
The terminal consumes them in xterm.js before rendering; they never appear
on screen.

## Files

| File | Role |
|---|---|
| `src-tauri/shell-integration/andspace.zsh` | zsh `precmd` / `preexec` hooks |
| `src-tauri/shell-integration/bash.placeholder` | Not implemented in v0.1 |
| `src-tauri/shell-integration/fish.placeholder` | Not implemented in v0.1 |
| `src/terminal/shellIntegration.ts` | OSC parsers + xterm handler registration |
| `src/terminal/terminalStore.ts` | `paneMeta`, `commandHistoryByPane` |

## Environment (set on PTY spawn)

| Variable | Value |
|---|---|
| `TERM_PROGRAM` | `AndSpace` |
| `ANDSPACE_SHELL_INTEGRATION` | `1` |
| `ANDSPACE_ZSH_INTEGRATION` | Absolute path to `andspace.zsh` (when bundled path exists) |

## Enable in a pane

After launching AndSpace (or `pnpm tauri dev`):

```zsh
source "$ANDSPACE_ZSH_INTEGRATION"
# or, if unset:
source /Users/you/Desktop/Andspace/src-tauri/shell-integration/andspace.zsh
```

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

zsh order per command: `start` → `cmd` → … run … → `end` (in next `precmd`).

## Frontend state

Per pane (`paneId` from Rust):

**`paneMeta`**

- `cwd`
- `lastCommand`
- `lastExitCode`
- `lastCommandStartedAt` / `lastCommandEndedAt` (ms)
- `outputBoundary` (xterm buffer line index at command start)
- `commandRunning`

**`commandHistoryByPane`**

- Up to 50 `CommandHistoryEntry` objects per pane

## Diagnostics

Each OSC event invokes `report_shell_event` → append to
`/tmp/andspace-diag.log`:

```
<ms> shell pane=p-abc osc kind=start boundary=42 ...
```

## Manual verification

1. Launch AndSpace.
2. In a pane: `source "$ANDSPACE_ZSH_INTEGRATION"`.
3. Run `pwd`, `echo hello`, `false`.
4. Inspect log:

```bash
tail -20 /tmp/andspace-diag.log
```

Expect lines containing `kind=cwd`, `kind=start`, `kind=cmd`, `kind=end`
with `exit=0` or `exit=1`.

5. Status bar (bottom right) should show the current directory after `pwd`.

## Limitations (v0.1)

- zsh only; bash/fish are placeholders.
- Integration is **not** auto-sourced; user must `source` once per shell session.
- Output boundary is a buffer **line index**, not byte offset.
- Command text may be truncated in diag logs (80 chars) for safety.
- OSC handlers consume sequences; malformed payloads are ignored.
