# Stack Decision — Phase 0

**Status: Matrix complete except #15 (deferred) and author sign-off.**

Fifteen benchmark rows remain in `docs/BENCHMARKS.md` after **#9 tmux was
removed** from scope. Fourteen rows have a verdict; **#15 (1 hr battery)**
was not run. **No final approved / rejected stamp** until the prototype
author adds the honest paragraph below.

## Full results (15 rows, tmux removed)

| # | Test | Result | Verdict |
|---|---|---|---|
| 1 | Cold launch | **387 ms** median of 3 | target |
| 2 | Idle CPU | **0.8 %** median | acceptable |
| 3 | Idle RSS | **105 MB** | target |
| 4 | Keystroke latency | subjective responsive (no typometer) | acceptable |
| 5 | `yes hello` throughput | **675k lines/sec** median of 3 | target |
| 6 | `cat /tmp/200mb.log` | **3.91 s** median of 3 | target |
| 7 | Dropped frames during #6 | subjective; no jank observed (Instruments not run) | acceptable |
| 8 | Neovim scroll | **smooth** | target |
| 10 | Two `tail -f` CPU | **1.6 %** main-proc median | target |
| 11 | Background-tab `tail -f` | renderer throttled when unfocused (3/3) | **fail** |
| 12 | 50k-line selection | **smooth** | target |
| 13 | IME (Kotoeri) | **works** | target |
| 14 | Mixed-DPI | **crisp on both** | target |
| 15 | 1 hr idle battery | not run | skipped |
| 16 | Rapid tab switching | **none** (no visible freeze); 13.36 s / 90 switches | target |

## Provisional gate tally (14 scored rows)

| Bucket | Count |
|---|---|
| target | 10 |
| acceptable | 3 (#2, #4, #7) |
| fail | 1 (#11) |
| skipped | 1 (#15) |

**10 + 3 = 13 / 14 scored = 93 %** in target or acceptable, **1 fail** (≤ 2).

Per `docs/PHASE_0.md`, that meets the **Approved** threshold — *if* the
author agrees the subjective rows (#4, #7) and skipped #15 are acceptable
for Phase 0 sign-off.

## Known limitation (#11)

Background-tab `tail -f` **fails** because WKWebView throttles rendering
when the AndSpace window loses focus. The PTY still receives bytes; the
screen does not keep up until refocus. This is a **Tauri / WebView
platform behavior**, not a JSON IPC or xterm throughput defect.

For v0.1 positioning:

> Foreground terminal performance passed throughput and scroll tests.
> Background-tab live tailing is a known limitation of the current
> WKWebView renderer path.

Do **not** reject the stack on #11 alone unless the product promise is
“perfect background log tailing without focus.”

## Throughput takeaway

Tests **#5** and **#6** cleared **target**. The feared JSON IPC /
terminal throughput bottleneck is **not** a Phase 0 blocker. If v0.1 needs
more headroom, `tauri::ipc::Channel<Vec<u8>>` remains an optimization path,
not a stack pivot.

## Remaining before final stamp

1. Optional: run **#15** (1 hr battery) and update `docs/BENCHMARKS.md`.
2. Required: **author paragraph** (see `docs/PHASE_0.md` “honest verdict”).
3. Then set **Status** above to Approved / Conditional / Rejected and
   delete this “pending” section.

## Gate rules (from `docs/PHASE_0.md`)

| Result distribution | Decision |
|---|---|
| ≥ 70 % target/acceptable, ≤ 2 fails | **Approved** → proceed to v0.1 |
| 50–69 % acceptable, 3–5 fails | **Conditional** → ship, drop Ghostty comparison publicly |
| < 50 % acceptable or > 5 fails | **Rejected** → pivot to native Swift + Metal |

## Author sign-off (fill in)

_Prototype author: one paragraph — did it feel daily-driver ready? Where
did you flinch? What should a Ghostty user expect?_
