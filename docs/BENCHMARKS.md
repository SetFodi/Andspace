# Phase 0 Benchmarks

| Field | Value |
|---|---|
| Machine | _fill in (e.g., MacBook Pro M3 Pro, 18GB)_ |
| macOS | _fill in (e.g., 14.6.1)_ |
| Ghostty version | _fill in_ |
| iTerm2 version | _fill in_ |
| AndSpace commit | _fill in_ |
| Date run | _fill in_ |

Repeat each test **3 times**, record the **median**. Mark each row
**target** / **acceptable** / **fail**.

## Checklist

| # | Test | Metric | Target | Acceptable | Fail | AndSpace | Ghostty | iTerm2 | Verdict |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Cold launch → first prompt | wall clock | < 400ms | < 800ms | > 1.2s | | | | |
| 2 | Idle CPU (1 tab, 60s avg) | Activity Monitor | < 0.3% | < 1% | > 2% | | | | |
| 3 | Idle RSS (1 tab) | Real Memory | < 180MB | < 250MB | > 350MB | | | | |
| 4 | Keystroke → glyph latency | typometer / 240fps cam | < 30ms | < 60ms | > 100ms | | | | |
| 5 | `yes hello` throughput | lines/sec rendered | > 200k | > 80k | < 30k | | | | |
| 6 | `cat 200mb.log` completion | wall clock | < 10s | < 25s | > 60s | | | | |
| 7 | Dropped frames during #6 | macOS Instruments | < 5% | < 15% | > 30% | | | | |
| 8 | Neovim + treesitter, 5k-line file scroll | subjective + FPS | smooth | usable | janky | | | | |
| 9 | tmux synchronized-panes redraw | render latency | smooth | usable | tears | | | | |
| 10 | Two panes `tail -f` busy logs | combined CPU | < 10% | < 25% | > 40% | | | | |
| 11 | Background-tab `tail -f` (window unfocused) | keeps up? | yes | mostly | throttled | | | | |
| 12 | Select 50k scrollback lines, drag | UI latency | smooth | usable | freezes | | | | |
| 13 | IME composition (Japanese via Kotoeri) | popup correct | works | minor | broken | | | | |
| 14 | Mixed-DPI: laptop + external 4K | font crispness | crisp on both | OK | blurry | | | | |
| 15 | 1hr idle, screen unlocked | battery % drop | < 2% | < 5% | > 10% | | | | |
| 16 | Switch tabs 10× rapidly | UI freeze | none | brief | locks | | | | |

## How to run each test

### #1 — Cold launch
Fully quit the app (⌘Q). Use screen recording at 60 FPS. Click the dock
icon. Stop the clock at the first frame where a shell prompt is
interactive (cursor visible, will respond to a keystroke).

### #2 — Idle CPU
Open one tab. Don't touch anything. Activity Monitor → CPU → andspace
process → watch for 60 seconds. Record average.

### #3 — Idle RSS
Activity Monitor → Memory → "Real Memory" column → andspace process,
1 tab open, idle.

### #4 — Keystroke latency
Easiest with iPhone slow-motion at 240 FPS: film keyboard and screen
together; count frames from key bottom-out to glyph appearing.
Alternative: [typometer](https://github.com/pavelfatin/typometer).

### #5 — `yes hello` throughput
Run `yes hello` in a pane for exactly 10 seconds, then Ctrl-C. Use
`yes hello | head -n 5000000 | wc -l` with `time` to measure how many
lines AndSpace could keep up with relative to the producer rate.

### #6 / #7 — `cat` a large log
Generate first:
```
yes "the quick brown fox jumps over the lazy dog 0123456789" \
  | head -c 200m > /tmp/200mb.log
```
Then `time cat /tmp/200mb.log`. Note real time. For #7, use Instruments
→ Frame Rate template during the cat.

### #8 — Neovim + treesitter
Clone the Linux kernel or any large repo. `nvim kernel/sched/core.c`
(or comparable big C/Rust file). Ensure treesitter is enabled.
Hold `j` for 10 seconds. Observe.

### #9 — tmux
```
tmux new-session
```
Split a few panes, `:setw synchronize-panes on`, run something busy
(`htop` or `ping -i 0.1 localhost`). Watch for tearing or render lag.

### #10 — Two tail -f
Open two panes side by side. In each:
```
tail -f /var/log/system.log
```
Watch combined CPU usage in Activity Monitor.

### #11 — Background tab
Set up #10. Cmd-Tab to another macOS app. Wait 30s. Cmd-Tab back. Did
the tail stream catch up smoothly, or did rendering pause?

### #12 — 50k-line selection
```
yes "the quick brown fox" | head -n 50000
```
Drag from top of scrollback to bottom. Observe selection latency.

### #13 — IME composition
System Settings → Keyboard → Input Sources → add Japanese (Kotoeri).
Switch to it, type `konnichiwa`. Verify composition popup appears in
the right place; verify the result is correct.

### #14 — Mixed-DPI
Plug in an external 4K monitor at native resolution. Move the window
between the laptop display and the external. Verify font remains
crisp on both. Common failure: blurry on one or both after hot-plug.

### #15 — 1hr idle battery
Charge to 100%, unplug, set Energy Saver to "Never sleep display."
Open AndSpace with 1 tab idle. Lock screen at mid brightness. Return
in 1 hour. Record battery drop. Compare against Ghostty under the
same setup (separate hour).

### #16 — Rapid tab switching
Open 9 tabs. Quickly cycle ⌘1 → ⌘9 → ⌘1 → ⌘9 for 10 seconds. Look
for UI freezes or dropped frames.

## After the run

Write `STACK_DECISION.md` at the repo root containing:

1. The filled table (or link to this file).
2. The decision (approved / conditional / rejected) per the gate rules
   in `PHASE_0.md`.
3. A one-paragraph honest assessment from the prototype author.
4. Specific known bottlenecks observed.
   Example: *"IPC serialization caps `yes hello` throughput at ~60k
   lines/sec — switching to `tauri::ipc::Channel<Vec<u8>>` for binary
   IPC is required for v0.1."*
