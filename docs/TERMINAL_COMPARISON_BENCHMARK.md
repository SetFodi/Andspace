# AndSpace vs Ghostty Terminal Benchmark

This benchmark is for quick dogfood comparisons between AndSpace and Ghostty.
It has three tiers:

| Tier | Workload | What It Stresses |
| --- | --- | --- |
| Easy | 20k plain lines | Basic PTY/render throughput and idle-ish CPU |
| Medium | 120k ANSI-colored lines | Build-log style output, ANSI parsing, scrollback growth |
| Heavy | 600k ANSI-colored wide lines | Sustained renderer pressure, memory, catch-up behavior |

The harness writes results to `benchmarks/terminal/`:

- `summary.json` for each run
- `samples.csv` with terminal-app CPU/RSS samples
- `comparison-*.md` when comparing latest AndSpace and Ghostty runs

`benchmarks/terminal/` is ignored by Git because these files are local machine
measurements, not source artifacts.

## What It Measures

- Output wall time.
- Terminal parser drain time using an ANSI Device Status Report.
- Lines per second.
- Approximate MiB per second.
- Terminal app CPU average, p95, max.
- Estimated terminal app CPU core-seconds.
- Terminal app peak RSS.
- Start/end battery percentage from `pmset -g batt`.

The benchmark reports both **write time** and **terminal drain**:

- Write time is only Python writing bytes into the PTY. A terminal can accept
  bytes quickly while the visible renderer is still catching up.
- Terminal drain sends an ANSI Device Status Report after the workload and waits
  for the response. That proves the terminal parser consumed the backlog. It is
  still not a frame-perfect paint timestamp, but it is the number to trust more
  than write time when comparing AndSpace and Ghostty.

Battery and energy numbers are intentionally best-effort. macOS battery percent
is coarse and short runs often show `0%` movement. Treat CPU core-seconds as the
more useful energy proxy. For a real energy trace, use Instruments Energy Log or
`sudo powermetrics` separately while the same tiers run.

On macOS, AndSpace renders through WKWebView helper processes. The harness
samples the AndSpace process plus WebKit WebContent/GPU helpers for AndSpace
runs. Close Safari, WebKit test apps, or other Tauri/WebView apps for the
cleanest CPU/RSS comparison.

## Run AndSpace

Open AndSpace, cd to the repo, then run:

```sh
./scripts/terminal-benchmark.py suite --label andspace --process andspace
```

If process inference misses the app, pass the exact PID:

```sh
pgrep -x andspace
./scripts/terminal-benchmark.py suite --label andspace --pid <PID>
```

## Run Ghostty

Open Ghostty, cd to the same repo, then run:

```sh
./scripts/terminal-benchmark.py suite --label ghostty --process Ghostty
```

If process inference misses Ghostty:

```sh
pgrep -if Ghostty
./scripts/terminal-benchmark.py suite --label ghostty --pid <PID>
```

## Compare Latest Runs

After both suites finish:

```sh
./scripts/terminal-benchmark.py compare --a andspace --b ghostty
```

This prints a table and writes a markdown report under `benchmarks/terminal/`.

## Quick Smoke Test

Use this to make sure the harness can run before doing real tests:

```sh
./scripts/terminal-benchmark.py run smoke --label andspace --process andspace
```

The smoke tier is not used for product claims.

## Clean Run Rules

Use the same conditions for both terminals:

- Same project directory.
- Same shell and prompt theme.
- Same font size.
- Same window size.
- Same display brightness.
- Same power state: either both plugged in or both unplugged.
- Close unrelated heavy apps.
- Do not run dev servers or video capture during the benchmark unless both runs
  use the exact same background load.

For battery comparison, run on battery, start both tests from a similar charge
range, and run the suite more than once:

```sh
./scripts/terminal-benchmark.py suite --label andspace --process andspace
./scripts/terminal-benchmark.py suite --label ghostty --process Ghostty
./scripts/terminal-benchmark.py compare --a andspace --b ghostty
```

If battery stays unchanged for both terminals, compare CPU core-seconds and peak
RSS instead of over-reading the battery field.

## Interpreting Winners

Use these practical rules:

- Faster: lower terminal-drain time and higher drain lines/sec.
- Raw write time is useful only as a producer/PTY throughput signal.
- If terminal drain times out, that terminal did not parse the heavy backlog
  within the timeout. Treat that as a renderer/backpressure failure for that
  tier, even if write time looks acceptable.
- Lighter CPU: lower CPU core-seconds.
- Better memory: lower peak RSS.
- Better battery proxy: lower CPU core-seconds over repeated runs.
- Smoother subjective feel still matters. If one terminal reports good numbers
  but visibly stutters during heavy output, record that in the comparison notes.

## Current Alpha Baseline

Latest local heavy-tier dogfood result on May 29, 2026:

| Terminal | Heavy drain | Drain lines/sec | Avg CPU | Peak RSS |
| --- | ---: | ---: | ---: | ---: |
| AndSpace | 3.97s | 151,179 | 98.6% | 717MB |
| Ghostty | 1.97s | 304,169 | 42.5% | 117MB |

This is acceptable for alpha dogfooding and normal local-development output,
but Ghostty remains much faster and lighter for pathological flood workloads.
The gap is expected: AndSpace currently renders through xterm.js inside
WKWebView, while Ghostty uses a native terminal core and GPU renderer.
