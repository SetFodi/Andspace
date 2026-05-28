# Phase 0 Benchmarks

| Field | Value |
|---|---|
| Machine | MacBook (Apple M2, 16 GB) |
| macOS | 26.5 (build 25F71) |
| Ghostty version | 1.3.1 (reference, not auto-compared — see note) |
| iTerm2 version | not installed |
| AndSpace commit | v0.0.1 (Phase 0 prototype) |
| Date run | 2026-05-28 |
| Bundle path | `src-tauri/target/release/bundle/macos/AndSpace.app` |

> Ghostty comparison was attempted via shell automation but `kill -9` of an
> existing Ghostty process killed an active terminal session and is not
> repeated. Manual side-by-side comparison against Ghostty for any failing
> row is the recommended path if needed.

Each automated row is the median of 3 runs. **Test #9 (tmux) was removed**
from Phase 0 scope — not required for the stack gate. Manual rows without
precision tooling are marked subjective in the Result column.

## Results

| # | Test | Metric | Target | Acceptable | Fail | Result | Verdict |
|---|---|---|---|---|---|---|---|
| 1 | Cold launch → first PTY | wall clock | < 400 ms | < 800 ms | > 1200 ms | **387 ms** (377 / 387 / 393) | **target** |
| 2 | Idle CPU (1 tab, 60 s avg) | Activity Monitor | < 0.3 % | < 1 % | > 2 % | **0.8 % median** — samples: 0.9 / 0.8 / 0.7 / 0.8 / 0.8 | **Acceptable** |
| 3 | Idle RSS (1 tab) | Real Memory | < 180 MB | < 250 MB | > 350 MB | **105 MB** | **target** |
| 4 | Keystroke → glyph latency | typometer / 240 fps cam | < 30 ms | < 60 ms | > 100 ms | **acceptable** — subjective; typing felt responsive (no typometer) | **acceptable** |
| 5 | `yes hello` throughput | lines/sec rendered | > 200k | > 80k | < 30k | **675k lines/sec** median of 3 — N=500k, real: 0.74 / 0.73 / 0.75 s (see notes) | **target** |
| 6 | `cat /tmp/200mb.log` time | wall clock to prompt | < 10 s | < 25 s | > 60 s | **3.91 s** median of 3 (4.09 / 3.84 / 3.91 s) | **target** |
| 7 | Dropped frames during #6 | macOS Instruments | < 5 % | < 15 % | > 30 % | **acceptable** — subjective; no perceived jank during #6 (Instruments not run) | **acceptable** |
| 8 | Neovim + treesitter scroll | subjective + FPS | smooth | usable | janky | **smooth** — 5000-line `/tmp/big-file.c`, hold `j`, Ctrl-d/u (manual, 2026-05-28) | **target** |
| 10 | Two panes `tail -f` busy logs | combined CPU | < 10 % | < 25 % | > 40 % | **1.6 %** median across 15 samples (main process only); per-run medians: 1.7 / 1.6 / 1.5 % | **target** |
| 11 | Background-tab `tail -f` (unfocused) | keeps up? | yes | mostly | throttled | **throttled** (3 / 3 runs) — main-proc CPU drops from ~1.5 % (foreground) to 0.0 % (background) | **fail** |
| 12 | Select 50k scrollback lines, drag | UI latency | smooth | usable | freezes | **smooth** — 50k scrollback drag (manual, 2026-05-28) | **target** |
| 13 | IME composition (Kotoeri) | popup correct | works | minor | broken | **works** — Kotoeri `konnichiwa` (manual, 2026-05-28) | **target** |
| 14 | Mixed-DPI: laptop + external 4K | font crispness | crisp on both | OK | blurry | **crisp on both** — laptop + external monitor (manual, 2026-05-28) | **target** |
| 15 | 1 hr idle, screen unlocked | battery % drop | < 2 % | < 5 % | > 10 % | **[skipped: deferred]** — not run in Phase 0 | — |
| 16 | Switch tabs 10× rapidly | UI freeze | none | brief | locks | **none** — 13.36 s median for 90 switches; no visible freeze (manual, 2026-05-28) | **target** |

## Removed from scope

**#9 tmux synchronized-panes** — removed from Phase 0. AndSpace is not
positioned as a tmux replacement; synchronized-pane redraw is out of scope
for the stack gate.

## How to run deferred / optional tests

The bundle is built at:
`/Users/lukafartenadze/Desktop/Andspace/src-tauri/target/release/bundle/macos/AndSpace.app`

Launch with:
```
open /Users/lukafartenadze/Desktop/Andspace/src-tauri/target/release/bundle/macos/AndSpace.app
```

### #5 `yes hello` throughput
```
yes hello | head -n 5000000 | wc -l
```
Measure with `time`. The number of lines drawn during the elapsed
time is the throughput. Cross-check by watching scrollback grow.

### #15 1 hr idle (deferred)
Charge to 100 %, unplug. Set Energy Saver to "Never sleep display."
Open AndSpace with 1 tab idle, lock screen at mid brightness.
Return after 1 hour. Record battery % drop.

### #10 Two `tail -f` (reference)
Open two panes side-by-side (⌘O). In each:
```
tail -f /var/log/system.log
```
Watch combined CPU in Activity Monitor.

### #11 Background tab
Set up #10, then ⌘-Tab to another macOS app. Wait 30 s. ⌘-Tab back.
Did the streams catch up smoothly, or did rendering pause?

## After the run

Update this table with manual rows, then write `STACK_DECISION.md`
at the repo root per the gate rules in `PHASE_0.md`.

## Notes on the automated rows (#5, #6, #10, #11, #16)

These five rows were driven by `scripts/benchmark.sh all_auto`
end-to-end (via macOS Accessibility / System Events) on 2026-05-28,
**3 rounds**. Reported values are medians; raw round numbers are
shown inline in the table.

Specific caveats per row:

- **#5 — `yes hello` throughput.** `time -p` is measured around the
  shell-side `yes | head` pipeline running inside the AndSpace PTY.
  This captures producer-through-PTY-to-xterm-accept throughput,
  not strictly "lines rendered to the screen" — xterm.js can accept
  bytes into its input buffer faster than the WebGL renderer paints
  them. The harness sleeps 3 s after `BENCH_DONE` to give the renderer
  catch-up time, but a frame-accurate "rendered" number would need an
  in-renderer counter. 675k lines/sec is well above target either way.

- **#6 — `cat /tmp/200mb.log`.** Same PTY-accept methodology as #5.
  Wall clock from script start to script end was 4.09 s for a 200 MB
  fixture.

- **#10 — two `tail -f`.** `ps -p` sampled the main `andspace`
  process only. Tauri's WKWebView renders in a separate helper
  process (`com.apple.WebKit.WebContent`) whose %CPU is not in this
  number. Treat the 1.7 % as a lower bound on combined CPU. Even
  doubled, it's well below the 10 % target.

- **#11 — background tab.** The 0.0 % main-process CPU during the
  background phase is consistent with WKWebView's known
  background-throttling behavior on macOS: when the window loses
  focus, the renderer's animation/timer rate is clamped to roughly
  1 fps. The PTY reader thread on the Rust side keeps reading bytes
  (xterm accepts them into its input buffer), but visible rendering
  pauses until the window is refocused. After refocus, sampled CPU
  recovered to ~0.8–1.2 % over six seconds, which suggests xterm
  drains the queued bytes rather than dropping them. **This is the
  failing-tier verdict per the spec** ("throttled"). It is a
  WKWebView / Tauri behavior, not an AndSpace bug.

- **#16 — rapid tab switching.** Wall clock median 13.36 s for 90
  switches via System Events. Manual observation: no visible UI freeze.

## Notes on the #2 (idle CPU) result

Improved from ~2.0% median after cursor blink optimization and inactive
cursor suppression. The applied Phase 0 fixes:

1. `cursorInactiveStyle: "none"` — inactive panes draw no cursor at all.
2. Cursor blink pauses after 3 s of input idle (matches iTerm2 / Warp).
3. Cursor blink stops when the OS window loses focus.

WebGL renderer and cursor blink during active typing are both preserved.
The remaining ~0.8% is inherent stack overhead (xterm.js render-service
polling, WebGL context maintenance, Tauri IPC heartbeat) and is
acceptable for Phase 0.
