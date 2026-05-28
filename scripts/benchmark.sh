#!/bin/bash
# AndSpace Phase 0 benchmark harness.
#
# Most rows drive the running AndSpace window via System Events keystrokes
# and require macOS Accessibility permission. See docs/BENCHMARK_RUNBOOK.md
# for setup. The harness probes for permission before any keystroke-based
# test and exits with a clear message if it's missing.
#
# Usage:
#   ./scripts/benchmark.sh <test>
#
# Tests:
#   cold        #1  cold launch (no Accessibility needed)
#   idle        #2 + #3 idle CPU + RSS (no Accessibility needed)
#   yh [N]      #5  yes hello throughput (default N = 500000)
#   cat         #6  cat /tmp/200mb.log
#   tails       #10 two panes tail -f
#   bgtab       #11 background tab tail-follow
#   tabswitch   #16 rapid tab switching
#   nvim_setup       #8  launches nvim with a big file — you observe
#   selection_setup  #12 fills 50k scrollback lines — you drag-select
#   all_auto         runs #5, #6, #10, #11, #16 in sequence
#   all_auto_x3      runs all_auto three times, prints medians
#
# Manual-only tests (#4, #7, #13, #14, #15) — see docs/BENCHMARK_RUNBOOK.md.

set -u

# ---------------------------------------------------------------------------
# Configuration

APP="/Users/lukafartenadze/Desktop/Andspace/src-tauri/target/release/bundle/macos/AndSpace.app"
DIAG=/tmp/andspace-diag.log
PROCESS_NAME=andspace
APP_NAME="AndSpace"   # name used by `tell application` and `tell process`

# ---------------------------------------------------------------------------
# Common helpers

now_ms() { python3 -c "import time; print(int(time.time() * 1000))"; }

require_accessibility() {
    local out
    out=$(osascript -e 'tell application "System Events" to get position of menu bar 1 of (first process whose frontmost is true)' 2>&1)
    if echo "$out" | grep -q "not allowed assistive access"; then
        cat >&2 <<'EOF'
ERROR: Accessibility permission not granted.

Grant via:
  System Settings → Privacy & Security → Accessibility
  Add the binary running this script (typically your terminal app)
  Toggle the switch ON

Then re-run.
EOF
        return 1
    fi
    return 0
}

kill_app() {
    pkill -x "$PROCESS_NAME" 2>/dev/null
    sleep 1
}

wait_for_first_pty() {
    local deadline=$(($(date +%s) + 15))
    while [ "$(date +%s)" -lt "$deadline" ]; do
        if grep -q "pty-create" "$DIAG" 2>/dev/null; then
            return 0
        fi
        sleep 0.05
    done
    return 1
}

first_pty_ms() {
    grep "pty-create" "$DIAG" 2>/dev/null | head -1 | awk '{print $1}'
}

launch_andspace() {
    kill_app
    : > "$DIAG"
    sleep 2
    open "$APP"
    wait_for_first_pty || return 1
    sleep 2  # WebView settle
    osascript -e "tell application \"$APP_NAME\" to activate" >/dev/null 2>&1
    sleep 0.5
    return 0
}

# Type a string into the frontmost AndSpace pane and press Enter.
type_in_andspace() {
    local cmd="$1"
    # AppleScript string literal: backslash-escape any embedded quotes.
    local escaped=${cmd//\\/\\\\}
    escaped=${escaped//\"/\\\"}
    osascript <<EOF >/dev/null 2>&1
tell application "System Events"
  keystroke "$escaped"
  delay 0.1
  key code 36
end tell
EOF
}

# Send a key code (number) with one or more modifiers.
# Common key codes: Return=36, Tab=48, Escape=53, Left=123, Right=124, Down=125, Up=126
send_keycode_with_mods() {
    local keycode="$1"
    local mods="$2"
    osascript <<EOF >/dev/null 2>&1
tell application "System Events"
  key code $keycode using {${mods} down}
end tell
EOF
}

# Send a character with modifiers.
send_keystroke_with_mods() {
    local char="$1"
    local mods="$2"
    osascript <<EOF >/dev/null 2>&1
tell application "System Events"
  keystroke "$char" using {${mods} down}
end tell
EOF
}

# Sample CPU% / RSS(MB) for the AndSpace process N times every D seconds.
# Prints one line per sample.
sample_ps() {
    local n="$1" delay="$2"
    local pid
    pid=$(pgrep -x "$PROCESS_NAME" | head -1)
    if [ -z "$pid" ]; then
        echo "  no andspace pid"
        return 1
    fi
    for i in $(seq 1 "$n"); do
        local line cpu rss rss_mb
        line=$(ps -p "$pid" -o %cpu,rss | tail -1)
        cpu=$(echo "$line" | awk '{print $1}')
        rss=$(echo "$line" | awk '{print $2}')
        rss_mb=$((rss / 1024))
        printf "  sample %d  cpu=%s%%  rss=%sMB\n" "$i" "$cpu" "$rss_mb"
        sleep "$delay"
    done
}

# ---------------------------------------------------------------------------
# #5 yes hello throughput
# Writes a shell script that times `yes hello | head -n N` with output going
# to the PTY (and so to xterm). The shell `time` output is redirected to a
# file the harness then reads.
bench_yh() {
    require_accessibility || return 1
    local lines="${1:-500000}"
    echo "=== Test #5: yes hello throughput (N=$lines) ==="

    cat > /tmp/yh-bench.sh <<EOF
#!/bin/bash
rm -f /tmp/yh-time.txt /tmp/yh-done
/usr/bin/time -p sh -c "yes hello | head -n $lines" 2> /tmp/yh-time.txt
echo BENCH_DONE > /tmp/yh-done
EOF
    chmod +x /tmp/yh-bench.sh

    launch_andspace || { echo "  FAILED to launch app"; return 1; }
    rm -f /tmp/yh-time.txt /tmp/yh-done

    type_in_andspace "/tmp/yh-bench.sh"

    local deadline=$(($(date +%s) + 180))
    while [ ! -f /tmp/yh-done ] && [ "$(date +%s)" -lt "$deadline" ]; do
        sleep 0.5
    done

    if [ ! -f /tmp/yh-done ]; then
        echo "  TIMEOUT — did not complete in 180s"
        kill_app
        return 1
    fi
    sleep 3  # let xterm finish rendering

    echo "  /usr/bin/time output:"
    sed 's/^/    /' /tmp/yh-time.txt
    local real
    real=$(grep "real" /tmp/yh-time.txt | awk '{print $2}')
    if [ -n "$real" ]; then
        local throughput
        throughput=$(python3 -c "print(int($lines / $real))")
        echo "  throughput: $throughput lines/sec"
    fi
    kill_app
}

# ---------------------------------------------------------------------------
# #6 cat /tmp/200mb.log
bench_cat() {
    require_accessibility || return 1
    echo "=== Test #6: cat /tmp/200mb.log ==="

    if [ ! -f /tmp/200mb.log ]; then
        echo "  fixture /tmp/200mb.log missing. Regenerate:"
        echo "    yes \"the quick brown fox jumps over the lazy dog 0123456789\" | head -c \$((200*1024*1024)) > /tmp/200mb.log"
        return 1
    fi

    cat > /tmp/cat-bench.sh <<'EOF'
#!/bin/bash
rm -f /tmp/cat-time.txt /tmp/cat-done
/usr/bin/time -p cat /tmp/200mb.log 2> /tmp/cat-time.txt
echo BENCH_DONE > /tmp/cat-done
EOF
    chmod +x /tmp/cat-bench.sh

    launch_andspace || { echo "  FAILED"; return 1; }
    rm -f /tmp/cat-time.txt /tmp/cat-done

    type_in_andspace "/tmp/cat-bench.sh"

    local deadline=$(($(date +%s) + 600))
    while [ ! -f /tmp/cat-done ] && [ "$(date +%s)" -lt "$deadline" ]; do
        sleep 1
    done

    if [ ! -f /tmp/cat-done ]; then
        echo "  TIMEOUT (after 10 minutes)"
        kill_app
        return 1
    fi
    sleep 5  # xterm finish rendering

    echo "  /usr/bin/time output:"
    sed 's/^/    /' /tmp/cat-time.txt
    echo "  fixture size: $(du -h /tmp/200mb.log | awk '{print $1}')"
    kill_app
}

# ---------------------------------------------------------------------------
# #10 two panes tail -f, combined CPU
# Order matters: type tail in pane 1 first, then ⌘O to split right (which
# moves focus to pane 2), then type tail in pane 2.
bench_tails() {
    require_accessibility || return 1
    echo "=== Test #10: two panes tail -f, combined CPU ==="

    launch_andspace || { echo "  FAILED"; return 1; }

    # Pane 1
    type_in_andspace "tail -f /var/log/system.log"
    sleep 1

    # Split right (creates pane 2, focuses it)
    send_keystroke_with_mods "o" "command"
    sleep 1

    # Pane 2
    type_in_andspace "tail -f /var/log/system.log"
    sleep 2

    echo "  baseline (no tails) measured earlier as ~0.8% idle"
    echo "  sampling combined CPU with two tails running:"
    sample_ps 5 3

    kill_app
}

# ---------------------------------------------------------------------------
# #11 background tab tail-follow
# Compares CPU baseline (window focused) vs background (focused elsewhere)
# to detect WebKit throttling.
bench_bgtab() {
    require_accessibility || return 1
    echo "=== Test #11: background tab tail-follow ==="

    launch_andspace || { echo "  FAILED"; return 1; }

    # Start a tail in pane 1 — high-volume so the renderer is exercised
    type_in_andspace "tail -f /var/log/system.log"
    sleep 2

    echo "  --- foreground phase (window focused, 10s) ---"
    sample_ps 5 2

    # Switch focus away
    echo "  --- switching focus to Finder ---"
    osascript -e 'tell application "Finder" to activate' >/dev/null 2>&1
    sleep 1

    echo "  --- background phase (focused elsewhere, 10s) ---"
    sample_ps 5 2

    # Refocus AndSpace
    echo "  --- refocusing AndSpace ---"
    osascript -e "tell application \"$APP_NAME\" to activate" >/dev/null 2>&1
    sleep 2

    echo "  --- post-refocus phase (catching up, 6s) ---"
    sample_ps 3 2

    echo "  Note: significantly lower CPU during background phase indicates"
    echo "  WebKit throttling of the WebView's render loop. The PTY keeps"
    echo "  receiving bytes regardless — the question is rendering pace."

    kill_app
}

# ---------------------------------------------------------------------------
# #16 rapid tab switching
# Opens 9 tabs, rapidly cycles ⌘1..⌘9 ten times each, measures wall-clock.
# Visual freeze observation is still on the user.
bench_tabswitch() {
    require_accessibility || return 1
    echo "=== Test #16: rapid tab switching ==="

    launch_andspace || { echo "  FAILED"; return 1; }

    # Open 8 more tabs (we have 1 from launch)
    for i in 1 2 3 4 5 6 7 8; do
        send_keystroke_with_mods "t" "command"
        sleep 0.25
    done

    sleep 1
    echo "  9 tabs open. Rapidly cycling ⌘1..⌘9 ten times..."

    local start end delta
    start=$(now_ms)
    for round in 1 2 3 4 5 6 7 8 9 10; do
        for n in 1 2 3 4 5 6 7 8 9; do
            send_keystroke_with_mods "$n" "command"
        done
    done
    end=$(now_ms)
    delta=$((end - start))

    echo "  90 switches in ${delta} ms"
    if [ "$delta" -gt 0 ]; then
        echo "  rate: $(python3 -c "print(round(90000/$delta, 1))") switches/sec"
    fi
    echo "  Note: UI freeze observation requires watching the screen."
    echo "  Sampling CPU during the run is meaningless (it ended already)."

    sleep 2
    kill_app
}

# ---------------------------------------------------------------------------
# #8 Neovim — partial setup
setup_nvim() {
    require_accessibility || return 1
    echo "=== Test #8 setup: open neovim with a large file ==="

    if ! command -v nvim >/dev/null 2>&1; then
        echo "  nvim not installed. Install with: brew install neovim"
        return 1
    fi

    local target=/tmp/big-file.c
    if [ ! -f "$target" ] || [ $(wc -l < "$target") -lt 5000 ]; then
        echo "  generating $target (5000 lines)..."
        python3 -c "
for i in range(5000):
    print(f'int function_{i}(int x, int y) {{ return x + y + {i}; }}')
" > "$target"
    fi

    launch_andspace || { echo "  FAILED"; return 1; }

    type_in_andspace "nvim $target"
    sleep 3
    echo
    echo "  nvim is open with $target ($(wc -l < "$target") lines)."
    echo "  Manually:"
    echo "    1. HOLD 'j' for 10s, observe scroll smoothness"
    echo "    2. Try Ctrl-d / Ctrl-u for half-page jumps"
    echo "    3. Verdict: smooth / usable / janky"
    echo "    4. Exit with :q!"
    echo
    echo "  App is left running. Close when you're done."
}

# ---------------------------------------------------------------------------
# #1 cold launch (no Accessibility)
bench_cold() {
    echo "=== Test #1: cold launch — 3 runs ==="
    local runs=()
    local i delta pty_time start
    for i in 1 2 3; do
        kill_app
        : > "$DIAG"
        sleep 2
        start=$(now_ms)
        open "$APP"
        if ! wait_for_first_pty; then
            echo "  run $i: TIMEOUT"
            continue
        fi
        pty_time=$(first_pty_ms)
        if [ -z "$pty_time" ]; then
            echo "  run $i: no pty timestamp in diag log"
            continue
        fi
        delta=$((pty_time - start))
        echo "  run $i: ${delta} ms"
        runs+=("$delta")
        sleep 1
    done
    kill_app
    if [ "${#runs[@]}" -ge 3 ]; then
        local median
        median=$(printf '%s\n' "${runs[@]}" | sort -n | sed -n '2p')
        echo "  median: ${median} ms"
    fi
}

# ---------------------------------------------------------------------------
# #2 + #3 idle CPU / RSS (no Accessibility)
bench_idle() {
    echo "=== Test #2 + #3: idle CPU / RSS — 60s settle, 5 samples ==="
    kill_app
    : > "$DIAG"
    sleep 2
    open "$APP"
    if ! wait_for_first_pty; then
        echo "  app did not start"
        return 1
    fi
    echo "  app ready, settling 60s..."
    sleep 60
    local pid
    pid=$(pgrep -x "$PROCESS_NAME" | head -1)
    if [ -z "$pid" ]; then
        echo "  could not find pid"
        return 1
    fi
    echo "  pid=$pid"
    local cpus=()
    local i line cpu rss rss_mb
    for i in 1 2 3 4 5; do
        line=$(ps -p "$pid" -o %cpu,rss | tail -1)
        cpu=$(echo "$line" | awk '{print $1}')
        rss=$(echo "$line" | awk '{print $2}')
        rss_mb=$((rss / 1024))
        printf "  sample %d  cpu=%s%%  rss=%sMB\n" "$i" "$cpu" "$rss_mb"
        cpus+=("$cpu")
        sleep 2
    done
    kill_app
    if [ "${#cpus[@]}" -ge 3 ]; then
        local median
        median=$(printf '%s\n' "${cpus[@]}" | sort -n | sed -n '3p')
        echo "  cpu median (sample 3 of 5 sorted): ${median}%"
    fi
}

# ---------------------------------------------------------------------------
# #12 selection — partial setup
setup_selection() {
    require_accessibility || return 1
    echo "=== Test #12 setup: 50k scrollback lines ==="

    cat > /tmp/sel-bench.sh <<'EOF'
#!/bin/bash
rm -f /tmp/sel-done
yes "the quick brown fox" | head -n 50000
echo BENCH_DONE > /tmp/sel-done
EOF
    chmod +x /tmp/sel-bench.sh

    launch_andspace || { echo "  FAILED"; return 1; }
    rm -f /tmp/sel-done

    type_in_andspace "/tmp/sel-bench.sh"

    local deadline=$(($(date +%s) + 120))
    while [ ! -f /tmp/sel-done ] && [ "$(date +%s)" -lt "$deadline" ]; do
        sleep 0.5
    done

    if [ ! -f /tmp/sel-done ]; then
        echo "  TIMEOUT — scrollback fill did not finish in 120s"
        kill_app
        return 1
    fi
    sleep 2
    echo
    echo "  50k lines are in scrollback. Manually:"
    echo "    1. Scroll to the top of the buffer"
    echo "    2. Click-and-drag to the bottom of the visible region"
    echo "    3. Watch for UI lag or freezes during the drag"
    echo "    4. Verdict: smooth / usable / freezes"
    echo
    echo "  App is left running. Close when done."
}

# ---------------------------------------------------------------------------
median_from_logs() {
    python3 <<'PY'
import re
import statistics
from pathlib import Path

logs = [Path(f"/tmp/andspace-run{i}.log") for i in (1, 2, 3)]
missing = [p for p in logs if not p.exists()]
if missing:
    print("  missing logs:", ", ".join(str(p) for p in missing))
    print("  run: ./scripts/benchmark.sh all_auto_x3")
    raise SystemExit(1)

def parse_logs():
    data = {"yh_real": [], "yh_tput": [], "cat_real": [], "tails_cpu": [],
            "bgtab_fg": [], "bgtab_bg": [], "tabs_ms": []}
    for path in logs:
        text = path.read_text()
        m = re.search(r"real ([0-9.]+)", text.split("=== Test #5")[1])
        if m:
            data["yh_real"].append(float(m.group(1)))
        m = re.search(r"throughput: (\d+) lines/sec", text.split("=== Test #5")[1])
        if m:
            data["yh_tput"].append(int(m.group(1)))
        m = re.search(r"real ([0-9.]+)", text.split("=== Test #6")[1])
        if m:
            data["cat_real"].append(float(m.group(1)))
        block = text.split("=== Test #10")[1].split("=== Test #11")[0]
        cpus = [float(x) for x in re.findall(r"sample \d+  cpu=([0-9.]+)%", block)]
        if cpus:
            data["tails_cpu"].append(statistics.median(cpus))
        block = text.split("=== Test #11")[1].split("=== Test #16")[0]
        fg_block = block.split("foreground phase", 1)[-1].split("background phase")[0]
        bg_block = block.split("background phase", 1)[-1].split("refocusing")[0]
        fg_cpus = [float(x) for x in re.findall(r"sample \d+  cpu=([0-9.]+)%", fg_block)]
        bg_cpus = [float(x) for x in re.findall(r"sample \d+  cpu=([0-9.]+)%", bg_block)]
        if fg_cpus:
            data["bgtab_fg"].append(statistics.median(fg_cpus))
        if bg_cpus:
            data["bgtab_bg"].append(statistics.median(bg_cpus))
        m = re.search(r"90 switches in (\d+) ms", text.split("=== Test #16")[1])
        if m:
            data["tabs_ms"].append(int(m.group(1)))
    return data

def med(vals):
    return statistics.median(vals) if vals else None

d = parse_logs()
print("=== Medians from /tmp/andspace-run{1,2,3}.log ===")
if d["yh_tput"]:
    print(f"  #5  throughput: {int(med(d['yh_tput'])):,} lines/sec  (runs: {d['yh_tput']})")
if d["yh_real"]:
    print(f"  #5  real time:   {med(d['yh_real']):.2f} s  (runs: {d['yh_real']})")
if d["cat_real"]:
    print(f"  #6  cat real:    {med(d['cat_real']):.2f} s  (runs: {d['cat_real']})")
if d["tails_cpu"]:
    print(f"  #10 tails CPU:   {med(d['tails_cpu']):.1f}% median per run  (runs: {d['tails_cpu']})")
if d["bgtab_fg"] and d["bgtab_bg"]:
    print(f"  #11 foreground:  {med(d['bgtab_fg']):.1f}%  background: {med(d['bgtab_bg']):.1f}%")
    if med(d["bgtab_bg"]) < 0.5:
        print("  #11 verdict:     throttled (background CPU ~0)")
if d["tabs_ms"]:
    ms = int(med(d["tabs_ms"]))
    print(f"  #16 tab switch:  {ms} ms for 90 switches ({90000/ms:.1f} sw/s)  (runs: {d['tabs_ms']})")
PY
}

run_all_auto_x3() {
    local i
    for i in 1 2 3; do
        echo "========== Round $i / 3 =========="
        {
            bench_yh && echo
            bench_cat && echo
            bench_tails && echo
            bench_bgtab && echo
            bench_tabswitch
        } 2>&1 | tee "/tmp/andspace-run$i.log" || return 1
        echo
    done
    median_from_logs
}

# ---------------------------------------------------------------------------
# Dispatch

usage() {
    sed -n '2,30p' "$0"
}

case "${1:-}" in
    cold)        bench_cold ;;
    idle)        bench_idle ;;
    yh)          bench_yh "${2:-500000}" ;;
    cat)         bench_cat ;;
    tails)       bench_tails ;;
    bgtab)       bench_bgtab ;;
    tabswitch)   bench_tabswitch ;;
    nvim_setup)       setup_nvim ;;
    selection_setup)  setup_selection ;;
    all_auto)
        bench_yh && echo
        bench_cat && echo
        bench_tails && echo
        bench_bgtab && echo
        bench_tabswitch
        ;;
    all_auto_x3) run_all_auto_x3 ;;
    median)      median_from_logs ;;
    -h|--help|"")
        usage
        ;;
    *)
        echo "Unknown test: $1" >&2
        usage >&2
        exit 1
        ;;
esac
