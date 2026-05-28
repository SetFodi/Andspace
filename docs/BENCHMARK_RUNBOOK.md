# Phase 0 Benchmark Runbook

This is the operator's guide for running `docs/BENCHMARKS.md`. It covers what
is automated, what requires the macOS Accessibility permission, what is
manual, how to grant Accessibility, and the exact manual commands to use as a
fallback if the automation cannot run.

The harness itself is `scripts/benchmark.sh`. Each automated test is a
subcommand of that script.

## 1. Test classification

### 1a. Fully automated (no Accessibility required)

These tests only `open` the app and observe it via `pgrep` / `ps` /
diagnostic log polling. They do **not** synthesize keystrokes.

| # | Test | Harness command |
|---|---|---|
| 1 | Cold launch → first PTY | `./scripts/benchmark.sh cold` |
| 2 | Idle CPU (60 s settle, 5 samples) | `./scripts/benchmark.sh idle` |
| 3 | Idle RSS (same run as #2) | `./scripts/benchmark.sh idle` |

`cold` and `idle` are implemented directly in `scripts/benchmark.sh` (no
`/tmp/andspace_bench.sh` dependency).

### 1b. Automated, but requires Accessibility permission

These tests drive AndSpace by typing into the frontmost window via
`osascript → System Events → keystroke / key code`. Every such call needs
Accessibility permission on the **app running the bash script** (see
§3 below).

| # | Test | Harness command | What it does |
|---|---|---|---|
| 5 | `yes hello` throughput | `./scripts/benchmark.sh yh [N]` | Launches app, types `/tmp/yh-bench.sh`, parses `/usr/bin/time -p`, computes lines/sec |
| 6 | `cat /tmp/200mb.log` time | `./scripts/benchmark.sh cat` | Launches app, types `/tmp/cat-bench.sh`, reports real time |
| 10 | Two panes `tail -f` busy logs | `./scripts/benchmark.sh tails` | Launches, runs tail in pane 1, ⌘O to split, runs tail in pane 2, samples CPU |
| 11 | Background-tab `tail -f` | `./scripts/benchmark.sh bgtab` | Foreground vs background CPU comparison; switches focus to Finder for the background phase |
| 16 | Rapid tab switching | `./scripts/benchmark.sh tabswitch` | ⌘T × 8, then ⌘1..⌘9 × 10 rounds, wall-clock timed |

Default for #5 is `N = 500000` lines. Pass a larger N for a heavier run,
e.g. `./scripts/benchmark.sh yh 5000000`.

`require_accessibility` runs before each of these tests and exits with a
clear error if the permission is missing.

### 1c. Partial automation (setup automated, verdict manual)

These open the right tool with the right inputs, then leave the app
running so you can drive the keystrokes that produce the qualitative
verdict (the verdict is "does it feel smooth").

| # | Test | Harness command | What you do after |
|---|---|---|---|
| 8 | Neovim + treesitter scroll | `./scripts/benchmark.sh nvim_setup` | Hold `j` for 10 s, try Ctrl-d / Ctrl-u. Record smooth / usable / janky. Exit with `:q!` |
| 12 | 50k-line selection drag | `./scripts/benchmark.sh selection_setup` | Scroll to top, drag-select to bottom. Record smooth / usable / freezes |

**#9 tmux** was removed from Phase 0 scope (not in the harness).

Setup requires Accessibility (the script types the command that
launches `nvim` or fills scrollback).

### 1d. Manual only

These cannot be automated reliably with shell tooling. They require
external instrumentation, GPU configurations, OS settings changes, or
human observation of UI rendering quality.

| # | Test | Why it's manual |
|---|---|---|
| 4  | Keystroke → glyph latency | Needs 240 fps camera or `typometer`; clock starts at physical key bottom-out |
| 7  | Dropped frames during #6 | Needs **macOS Instruments → Frame Rate** template attached to the AndSpace process |
| 12 | 50k-line selection drag   | Needs human mouse-drag; UI-latency observation is subjective |
| 13 | IME composition (Kotoeri) | Needs Japanese input source enabled in System Settings; popup placement is visual |
| 14 | Mixed-DPI: laptop + 4K   | Needs an external 4K monitor and hot-plug between displays |
| 15 | 1 hr idle battery        | Needs a fully charged battery, unplugged, 1 hour wall clock with the lid open |

## 2. End-to-end run order

```
# (1) Fully automated, no permission needed
./scripts/benchmark.sh cold        # writes #1
./scripts/benchmark.sh idle        # writes #2 + #3

# (2) Grant Accessibility (see §3), then either:
./scripts/benchmark.sh all_auto       # one round of #5, #6, #10, #11, #16
./scripts/benchmark.sh all_auto_x3    # three rounds + printed medians
# Or re-parse existing logs:
./scripts/benchmark.sh median

# (3) Partial-automation rows (if re-running)
./scripts/benchmark.sh nvim_setup
./scripts/benchmark.sh selection_setup

# (4) Manual rows (#4, #7, #13, #14, #15) — see §4.
```

Phase 0 results are recorded in `docs/BENCHMARKS.md`. Update
`STACK_DECISION.md` only when adding new measurements or the author
sign-off paragraph.

## 3. Granting Accessibility permission

The permission must be granted to **the app that runs the bash script**,
not to AndSpace itself and not to `osascript`. AndSpace is the *target*
of the synthesized events; the *sender* is the terminal that invokes
`osascript`.

### Steps (macOS 14+)

1. Open `System Settings`.
2. `Privacy & Security` → `Accessibility`.
3. Click the `+` button. Authenticate with Touch ID / password if asked.
4. Navigate to and select the application from which you will run
   `./scripts/benchmark.sh`:
   - If you run it from `Terminal.app`: `/System/Applications/Utilities/Terminal.app`
   - If you run it from iTerm2: `/Applications/iTerm.app`
   - If you run it from Cursor's integrated terminal: `/Applications/Cursor.app`
   - If you run it from VS Code's integrated terminal: `/Applications/Visual Studio Code.app`
5. Toggle the switch **ON** for that entry.
6. Fully quit and reopen that app (`⌘Q`, then relaunch). Some terminal
   apps cache the TCC decision per process and won't pick up the change
   in the current session.
7. Verify with:
   ```
   osascript -e 'tell application "System Events" to get name of first process whose frontmost is true'
   ```
   If you get a name back, you're good. If you get
   `Application isn't running. (-600)` or
   `osascript is not allowed assistive access. (-1719)`, the permission
   is still missing.

### What the harness will tell you if it's missing

Every Accessibility-dependent subcommand begins with
`require_accessibility`. If the permission is missing, the harness prints:

```
ERROR: Accessibility permission not granted.

Grant via:
  System Settings → Privacy & Security → Accessibility
  Add the binary running this script (typically your terminal app)
  Toggle the switch ON

Then re-run.
```

and exits non-zero before any keystroke is sent.

## 4. Manual fallback — exact commands

If automation can't be granted permission, here is the exact procedure
for the rows that *would* be automated, plus the always-manual rows.

The bundle is at:

```
/Users/lukafartenadze/Desktop/Andspace/src-tauri/target/release/bundle/macos/AndSpace.app
```

Launch with:

```
open /Users/lukafartenadze/Desktop/Andspace/src-tauri/target/release/bundle/macos/AndSpace.app
```

### #4 — Keystroke → glyph latency (always manual)

- Easiest: film keyboard + screen with iPhone slow-motion at 240 fps.
  Count frames from key bottom-out to first frame the glyph appears.
- Alternative: install [typometer](https://github.com/pavelfatin/typometer)
  and run it against the focused AndSpace pane.

Target / acceptable / fail: `< 30 ms` / `< 60 ms` / `> 100 ms`.

### #5 — `yes hello` throughput (manual fallback)

In an AndSpace pane:

```
/usr/bin/time -p sh -c 'yes hello | head -n 5000000 | wc -l'
```

Read the `real` line. Throughput is `5000000 / real`. Cross-check by
watching scrollback grow during the run.

Target / acceptable / fail: `> 200k` / `> 80k` / `< 30k` lines/sec.

### #6 — `cat /tmp/200mb.log` (manual fallback)

Fixture is already at `/tmp/200mb.log` (≈ 210 MB of repeating text).
If missing, regenerate with:

```
yes "the quick brown fox jumps over the lazy dog 0123456789" \
  | head -c $((200*1024*1024)) > /tmp/200mb.log
```

Then in an AndSpace pane:

```
/usr/bin/time -p cat /tmp/200mb.log
```

Target / acceptable / fail: `< 10 s` / `< 25 s` / `> 60 s`.

### #7 — Dropped frames during #6 (always manual)

1. Open `Instruments.app` (ships with Xcode).
2. Choose the `Frame Rate` template (or `Metal System Trace` if you
   want renderer-side detail).
3. `Target` → `Attach to process` → `AndSpace`.
4. Hit `Record`, then run `cat /tmp/200mb.log` in AndSpace.
5. Stop the trace when the prompt returns. Read the dropped-frame
   percentage from the Frame Rate track.

Target / acceptable / fail: `< 5 %` / `< 15 %` / `> 30 %`.

### #8 — Neovim + treesitter (manual fallback if `nvim_setup` can't run)

```
nvim /tmp/big-file.c   # create with: python3 -c "for i in range(5000): print(f'int f_{i}() {{ return {i}; }}')" > /tmp/big-file.c
```

Hold `j` for 10 seconds. Try `Ctrl-d` / `Ctrl-u`. Verdict:
smooth / usable / janky. Exit with `:q!`.

### #10 — Two `tail -f` (manual fallback)

In AndSpace:

1. Open a pane and run:
   ```
   tail -f /var/log/system.log
   ```
2. Press `⌘O` to split right (now you have two panes).
3. In the new pane:
   ```
   tail -f /var/log/system.log
   ```
4. Open Activity Monitor → CPU → filter `andspace`. Watch combined
   CPU over ~10 seconds. Tauri spawns a WebView helper; add that
   helper's `%CPU` to the main process's `%CPU` for a true total.

Target / acceptable / fail: `< 10 %` / `< 25 %` / `> 40 %`.

### #11 — Background-tab `tail -f` (manual fallback)

1. Set up #10.
2. Note CPU% in Activity Monitor (foreground reference).
3. `⌘-Tab` to Finder (or any other app). Leave focus there 30 s.
4. Glance at Activity Monitor without bringing AndSpace forward —
   has the CPU dropped substantially (i.e. WebKit throttled the
   render loop)? Or is it the same (PTY is still rendering)?
5. `⌘-Tab` back. Did the streams catch up smoothly or did the
   first second look like a single-frame jump from an old state?

Verdict: yes / mostly / throttled.

### #12 — 50k-line selection (always manual)

In a pane:

```
yes "the quick brown fox" | head -n 50000
```

Click-and-drag from the top of the scrollback to the bottom of the
visible region. Watch for UI latency or freezes during the drag.

Verdict: smooth / usable / freezes.

### #13 — IME composition (always manual)

1. `System Settings → Keyboard → Input Sources → +` → `Japanese` → `Kotoeri`.
2. Switch to Kotoeri (`Ctrl-Space` or the input-method menu bar item).
3. In an AndSpace pane, type `konnichiwa`. The composition popup
   should appear at the cursor; the result should be `こんにちは`
   (or the Hiragana you confirmed).

Verdict: works / minor issues / broken.

### #14 — Mixed-DPI (always manual)

1. Plug in an external monitor at native resolution.
2. Drag the AndSpace window between the laptop display and the
   external display.
3. The font must stay crisp on both. Common failure mode is a
   blurry render on the secondary display after the drag.

Verdict: crisp on both / OK / blurry.

### #15 — 1 hr idle battery (always manual)

1. Charge laptop to 100 %. Unplug.
2. `System Settings → Battery` → "Prevent automatic sleeping" or
   equivalent. Lid open, screen at mid brightness.
3. Open AndSpace with 1 tab idle. Lock the screen (`⌃⌘Q`).
4. Return after 1 hour. Record battery % drop.

Target / acceptable / fail: `< 2 %` / `< 5 %` / `> 10 %`.

### #16 — Rapid tab switching (manual fallback)

1. In AndSpace, press `⌘T` eight times to get 9 tabs.
2. Cycle `⌘1 → ⌘2 → … → ⌘9 → ⌘1 → …` as fast as you can for
   10 seconds.
3. Watch for UI freezes, dropped frames, or visible delay between
   keypress and tab content swap.

Verdict: none / brief / locks.

## 5. Recording results

After each row runs (automated or manual):

1. Update the `Result` and `Verdict` columns of the corresponding row
   in `docs/BENCHMARKS.md`.
2. If a row is skipped, replace `[needs you]` with `[skipped: <reason>]`
   so the final tally in `STACK_DECISION.md` is honest.
3. Only after every row is either resolved or explicitly skipped, edit
   `STACK_DECISION.md` and apply the gate rules in `docs/PHASE_0.md`.

No verdict ships until the table is complete.
