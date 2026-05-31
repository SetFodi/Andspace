#!/usr/bin/env python3
"""Idle / light-use energy harness for AndSpace vs Ghostty.

The throughput harness (`terminal-benchmark.py`) stresses worst-case output.
This one measures the metric that actually decides daily-driver viability:
how much energy a terminal burns while it is just *sitting there* focused at a
prompt (cursor, webview/renderer overhead, idle repaints).

It drives macOS `powermetrics` (needs sudo) and samples:

  - System Combined Power (CPU + GPU + ANE), in mW.
  - Per-process CPU ms/s and "Energy Impact" for the terminal app
    (plus its WebKit helper processes, for AndSpace).

Usage
-----
Open the terminal under test, leave it focused at an idle prompt, then from
*another* terminal (or the same one — it only reads metrics) run:

    sudo ./scripts/idle-power.py run --label andspace --process andspace --seconds 120
    sudo ./scripts/idle-power.py run --label ghostty  --process Ghostty  --seconds 120
    ./scripts/idle-power.py compare --a andspace --b ghostty

Quit Safari and other WebView/Electron apps first so WebKit-helper attribution
is clean (same caveat as the throughput harness).

Results are written under benchmarks/terminal/idle/ (git-ignored).
"""

from __future__ import annotations

import argparse
import json
import os
import re
import statistics
import subprocess
import sys
from datetime import datetime
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
RESULT_ROOT = ROOT / "benchmarks" / "terminal" / "idle"

COMBINED_RE = re.compile(r"Combined Power \(CPU \+ GPU \+ ANE\):\s*([\d.]+)\s*mW")
CPU_POWER_RE = re.compile(r"^CPU Power:\s*([\d.]+)\s*mW")
GPU_POWER_RE = re.compile(r"^GPU Power:\s*([\d.]+)\s*mW")

WEBKIT_HINTS = ("WebKit.WebContent", "WebKit.GPU", "WebKit.Networking", "com.apple.WebKit")


def pgrep(pattern: str) -> list[int]:
    try:
        out = subprocess.run(
            ["pgrep", "-i", pattern], capture_output=True, text=True, check=False
        ).stdout
    except FileNotFoundError:
        return []
    return [int(p) for p in out.split() if p.strip().isdigit()]


def infer_pids(process: str | None, pid: int | None) -> set[int]:
    pids: set[int] = set()
    if pid:
        pids.add(pid)
    if process:
        pids.update(pgrep(process))
    return pids


def parse_tasks_header(line: str) -> dict[str, int] | None:
    if "Name" not in line or "CPU ms/s" not in line:
        return None
    cols = re.split(r"\s{2,}", line.strip())
    index = {name: i for i, name in enumerate(cols)}
    if "Name" not in index:
        return None
    return index


def sample_matches(name: str, pid: int | None, label: str, pid_set: set[int]) -> bool:
    if pid is not None and pid in pid_set:
        return True
    low = name.lower()
    if label.lower() in low:
        return True
    if label == "andspace" and any(h.lower() in low for h in (x.lower() for x in WEBKIT_HINTS)):
        return True
    return False


def run(args: argparse.Namespace) -> Path:
    if os.geteuid() != 0:
        print("powermetrics needs root. Re-run with sudo.", file=sys.stderr)
        raise SystemExit(2)

    interval_ms = max(200, int(args.interval * 1000))
    n = max(1, round(args.seconds / args.interval))
    pid_set = infer_pids(args.process, args.pid)

    cmd = [
        "powermetrics",
        "--samplers",
        "tasks,cpu_power,gpu_power",
        "--show-process-energy",
        "-i",
        str(interval_ms),
        "-n",
        str(n),
    ]
    print(f"sampling {args.label}: {n} samples @ {interval_ms} ms "
          f"(~{n * interval_ms / 1000:.0f}s)")
    print(f"matching pids: {sorted(pid_set) or 'by name only'}")

    combined: list[float] = []
    cpu_mw: list[float] = []
    gpu_mw: list[float] = []
    app_cpu_ms: list[float] = []
    app_energy: list[float] = []

    proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, text=True)
    assert proc.stdout is not None

    header: dict[str, int] | None = None
    in_tasks = False
    block_cpu_ms = 0.0
    block_energy = 0.0
    block_has_app = False

    def flush_block() -> None:
        nonlocal block_cpu_ms, block_energy, block_has_app
        if block_has_app:
            app_cpu_ms.append(block_cpu_ms)
            app_energy.append(block_energy)
        block_cpu_ms = 0.0
        block_energy = 0.0
        block_has_app = False

    try:
        for raw in proc.stdout:
            line = raw.rstrip("\n")

            m = COMBINED_RE.search(line)
            if m:
                combined.append(float(m.group(1)))
                continue
            m = CPU_POWER_RE.match(line)
            if m:
                cpu_mw.append(float(m.group(1)))
                continue
            m = GPU_POWER_RE.match(line)
            if m:
                gpu_mw.append(float(m.group(1)))
                continue

            if line.startswith("*** Running tasks"):
                in_tasks = True
                header = None
                continue
            if line.startswith("***"):
                if in_tasks:
                    flush_block()
                in_tasks = False
                header = None
                continue

            if in_tasks:
                if header is None:
                    header = parse_tasks_header(line)
                    continue
                if not line.strip():
                    continue
                cols = re.split(r"\s{2,}", line.strip())
                if len(cols) <= header.get("Name", 0):
                    continue
                name = cols[header["Name"]]
                pid_val: int | None = None
                if "ID" in header and len(cols) > header["ID"]:
                    try:
                        pid_val = int(cols[header["ID"]])
                    except ValueError:
                        pid_val = None
                if not sample_matches(name, pid_val, args.label, pid_set):
                    continue
                block_has_app = True
                if "CPU ms/s" in header and len(cols) > header["CPU ms/s"]:
                    try:
                        block_cpu_ms += float(cols[header["CPU ms/s"]])
                    except ValueError:
                        pass
                if "Energy Impact" in header and len(cols) > header["Energy Impact"]:
                    try:
                        block_energy += float(cols[header["Energy Impact"]])
                    except ValueError:
                        pass
    finally:
        proc.wait()
        if in_tasks:
            flush_block()

    def avg(xs: list[float]) -> float:
        return round(statistics.fmean(xs), 2) if xs else 0.0

    avg_combined = avg(combined)
    summary: dict[str, Any] = {
        "schema": 1,
        "kind": "idle-power",
        "created_at": datetime.now().isoformat(timespec="seconds"),
        "label": args.label,
        "seconds": args.seconds,
        "interval_seconds": args.interval,
        "samples": len(combined) or len(app_cpu_ms),
        "system_combined_power_mw_avg": avg_combined,
        "system_cpu_power_mw_avg": avg(cpu_mw),
        "system_gpu_power_mw_avg": avg(gpu_mw),
        "app_cpu_ms_per_s_avg": avg(app_cpu_ms),
        "app_energy_impact_avg": avg(app_energy),
        # mWh the *whole system* would use at this average power over an hour.
        "system_energy_mwh_per_hour": round(avg_combined, 1),
        "matched_pids": sorted(pid_set),
    }

    RESULT_ROOT.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    out = RESULT_ROOT / f"{stamp}-{args.label}-idle.json"
    out.write_text(json.dumps(summary, indent=2))

    print()
    print(f"  system combined power : {summary['system_combined_power_mw_avg']:>8} mW")
    print(f"  app CPU ms/s          : {summary['app_cpu_ms_per_s_avg']:>8}")
    print(f"  app energy impact     : {summary['app_energy_impact_avg']:>8}")
    print(f"  wrote {out.relative_to(ROOT)}")
    return out


def latest(label: str) -> dict[str, Any] | None:
    files = sorted(RESULT_ROOT.glob(f"*-{label}-idle.json"))
    if not files:
        return None
    return json.loads(files[-1].read_text())


def compare(args: argparse.Namespace) -> None:
    a = latest(args.a)
    b = latest(args.b)
    if not a or not b:
        missing = args.a if not a else args.b
        print(f"no idle runs found for '{missing}'. Run `idle-power.py run` first.",
              file=sys.stderr)
        raise SystemExit(1)

    rows = [
        ("System combined power (mW)", "system_combined_power_mw_avg"),
        ("App CPU ms/s", "app_cpu_ms_per_s_avg"),
        ("App energy impact", "app_energy_impact_avg"),
    ]
    width = max(len(r[0]) for r in rows)
    print(f"\nIdle energy: {args.a} vs {args.b}\n")
    print(f"{'Metric'.ljust(width)}  {args.a:>12}  {args.b:>12}  {'ratio a/b':>10}")
    print("-" * (width + 40))
    for title, key in rows:
        va = float(a.get(key, 0) or 0)
        vb = float(b.get(key, 0) or 0)
        ratio = f"{va / vb:.2f}x" if vb else "n/a"
        print(f"{title.ljust(width)}  {va:>12}  {vb:>12}  {ratio:>10}")
    print("\nLower is better. 'app energy impact' is a relative macOS score, not "
          "watts; 'system combined power' is the trustworthy energy number.\n")


def main() -> int:
    parser = argparse.ArgumentParser(description="Idle/light-use energy harness.")
    sub = parser.add_subparsers(dest="command", required=True)

    p_run = sub.add_parser("run", help="Sample idle energy for one terminal.")
    p_run.add_argument("--label", required=True, help="e.g. andspace or ghostty")
    p_run.add_argument("--process", default=None, help="process name for pgrep")
    p_run.add_argument("--pid", type=int, default=None, help="explicit app pid")
    p_run.add_argument("--seconds", type=float, default=120.0)
    p_run.add_argument("--interval", type=float, default=1.0, help="sample seconds")
    p_run.set_defaults(func=run)

    p_cmp = sub.add_parser("compare", help="Compare the latest two idle runs.")
    p_cmp.add_argument("--a", default="andspace")
    p_cmp.add_argument("--b", default="ghostty")
    p_cmp.set_defaults(func=compare)

    args = parser.parse_args()
    args.func(args)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
