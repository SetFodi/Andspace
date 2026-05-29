#!/usr/bin/env python3
"""Terminal comparison harness for AndSpace vs Ghostty.

Run this script from inside the terminal being tested. It emits real terminal
output, samples the terminal app process, and writes JSON/CSV summaries under
benchmarks/terminal/.
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import re
import select
import statistics
import subprocess
import sys
import termios
import threading
import time
import tty
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
RESULT_ROOT = ROOT / "benchmarks" / "terminal"


@dataclass(frozen=True)
class Tier:
    name: str
    lines: int
    width: int
    ansi: bool
    settle_seconds: float
    drain_timeout_seconds: float
    description: str


TIERS: dict[str, Tier] = {
    "smoke": Tier(
        name="smoke",
        lines=200,
        width=72,
        ansi=True,
        settle_seconds=0.5,
        drain_timeout_seconds=5.0,
        description="Tiny validation run for the harness itself.",
    ),
    "easy": Tier(
        name="easy",
        lines=20_000,
        width=88,
        ansi=False,
        settle_seconds=2.0,
        drain_timeout_seconds=10.0,
        description="Small scrollback burst for basic throughput and CPU.",
    ),
    "medium": Tier(
        name="medium",
        lines=120_000,
        width=112,
        ansi=True,
        settle_seconds=3.0,
        drain_timeout_seconds=30.0,
        description="ANSI-heavy output similar to package manager/build logs.",
    ),
    "heavy": Tier(
        name="heavy",
        lines=600_000,
        width=144,
        ansi=True,
        settle_seconds=5.0,
        drain_timeout_seconds=90.0,
        description="Large sustained scrollback burst to stress renderer and memory.",
    ),
}


def now_stamp() -> str:
    return datetime.now().strftime("%Y%m%d-%H%M%S")


def slug(value: str) -> str:
    value = value.strip().lower()
    value = re.sub(r"[^a-z0-9._-]+", "-", value)
    return value.strip("-") or "terminal"


def run_text(command: list[str]) -> str:
    try:
        return subprocess.check_output(command, text=True, stderr=subprocess.DEVNULL).strip()
    except Exception:
        return ""


def parse_battery_percent(text: str) -> int | None:
    match = re.search(r"(\d+)%", text)
    return int(match.group(1)) if match else None


def battery_snapshot() -> dict[str, Any]:
    raw = run_text(["pmset", "-g", "batt"])
    return {
        "percent": parse_battery_percent(raw),
        "raw": raw,
    }


def process_info(pid: int) -> tuple[int | None, str]:
    out = run_text(["ps", "-p", str(pid), "-o", "ppid=,comm="])
    if not out:
        return None, ""
    parts = out.strip().split(None, 1)
    if not parts:
        return None, ""
    try:
        ppid = int(parts[0])
    except ValueError:
        ppid = None
    comm = parts[1] if len(parts) > 1 else ""
    return ppid, comm


def process_start_epoch(pid: int) -> float | None:
    raw = run_text(["ps", "-p", str(pid), "-o", "lstart="]).strip()
    if not raw:
        return None
    try:
        return datetime.strptime(raw, "%a %b %d %H:%M:%S %Y").timestamp()
    except ValueError:
        return None


def ancestor_chain(pid: int) -> list[tuple[int, str]]:
    chain: list[tuple[int, str]] = []
    seen: set[int] = set()
    current = pid
    while current > 1 and current not in seen:
        seen.add(current)
        ppid, comm = process_info(current)
        chain.append((current, comm))
        if ppid is None:
            break
        current = ppid
    return chain


def pgrep_candidates(pattern: str) -> list[int]:
    out = run_text(["pgrep", "-if", pattern])
    pids: list[int] = []
    for line in out.splitlines():
        try:
            pids.append(int(line.strip()))
        except ValueError:
            pass
    return pids


def webkit_helper_pids_for_app(app_pids: list[int]) -> list[int]:
    starts = [process_start_epoch(pid) for pid in app_pids]
    starts = [started for started in starts if started is not None]
    if not starts:
        return []

    earliest_app_start = min(starts) - 5
    helpers = [
        *pgrep_candidates("com.apple.WebKit.WebContent"),
        *pgrep_candidates("com.apple.WebKit.GPU"),
    ]
    filtered: list[int] = []
    for pid in helpers:
        started = process_start_epoch(pid)
        if started is not None and started >= earliest_app_start:
            filtered.append(pid)
    return filtered


def infer_app_pids(label: str, requested_process: str | None, requested_pid: int | None) -> list[int]:
    if requested_pid:
        return [requested_pid]

    patterns = [requested_process] if requested_process else []
    lowered = label.lower()
    if "andspace" in lowered:
        patterns.extend(["andspace", "AndSpace"])
    elif "ghostty" in lowered:
        patterns.extend(["Ghostty", "ghostty"])
    patterns.extend([label])

    pids: list[int] = []
    chain = ancestor_chain(os.getpid())
    for pattern in patterns:
        if not pattern:
            continue
        needle = pattern.lower()
        for pid, comm in chain:
            if needle in Path(comm).name.lower() or needle in comm.lower():
                pids.append(pid)

    for pattern in patterns:
        if not pattern:
            continue
        candidates = [pid for pid in pgrep_candidates(pattern) if pid != os.getpid()]
        if len(candidates) == 1:
            pids.extend(candidates)

    pids = unique_live_pids(pids)

    # Tauri on macOS renders through WKWebView helper processes. They are XPC
    # services with ppid=1, so they do not appear in the AndSpace process tree.
    # Include helpers that started with or after the sampled app; older helper
    # processes are usually stale WebKit processes from another app/window and
    # badly inflate RSS/CPU numbers.
    if "andspace" in lowered or (requested_process and "andspace" in requested_process.lower()):
        pids.extend(webkit_helper_pids_for_app(pids))

    return unique_live_pids(pids)


def unique_live_pids(pids: list[int]) -> list[int]:
    out: list[int] = []
    seen: set[int] = set()
    for pid in pids:
        if pid <= 1 or pid in seen:
            continue
        if process_info(pid)[1]:
            out.append(pid)
            seen.add(pid)
    return out


def sample_processes(pids: list[int], stop: threading.Event, samples: list[dict[str, Any]], interval: float) -> None:
    while not stop.is_set():
        total_cpu = 0.0
        total_rss = 0
        live_count = 0
        for pid in pids:
            out = run_text(["ps", "-p", str(pid), "-o", "%cpu=,rss="])
            if not out:
                continue
            parts = out.split()
            if len(parts) < 2:
                continue
            try:
                total_cpu += float(parts[0])
                total_rss += int(parts[1])
                live_count += 1
            except ValueError:
                continue
        if live_count:
            samples.append(
                {
                    "ts": time.time(),
                    "cpu_percent": total_cpu,
                    "rss_mb": total_rss / 1024,
                    "process_count": live_count,
                }
            )
        stop.wait(interval)


def line_payload(index: int, tier: Tier) -> bytes:
    marker = f"{tier.name.upper()} {index:07d} "
    filler_len = max(8, tier.width - len(marker) - 20)
    filler = ("abcdefghijklmnopqrstuvwxyz0123456789" * ((filler_len // 36) + 1))[:filler_len]
    if tier.ansi:
        color = 31 + (index % 6)
        text = f"\x1b[{color}m{marker}{filler}\x1b[0m  path=src/terminal/{index % 97:02d}.tsx\n"
    else:
        text = f"{marker}{filler}  path=src/terminal/{index % 97:02d}.tsx\n"
    return text.encode("utf-8", "replace")


def emit_workload(tier: Tier) -> tuple[int, int]:
    output = sys.stdout.buffer
    total_bytes = 0
    chunk: list[bytes] = []
    chunk_bytes = 0
    for index in range(1, tier.lines + 1):
        payload = line_payload(index, tier)
        chunk.append(payload)
        chunk_bytes += len(payload)
        if len(chunk) >= 512:
            output.write(b"".join(chunk))
            total_bytes += chunk_bytes
            chunk.clear()
            chunk_bytes = 0
    if chunk:
        output.write(b"".join(chunk))
        total_bytes += chunk_bytes
    output.flush()
    return tier.lines, total_bytes


def wait_for_terminal_dsr(timeout: float) -> tuple[float | None, str]:
    """Wait for a terminal Device Status Report response.

    This does not prove a frame was painted, but it does prove the terminal
    parser consumed all bytes before the DSR query. That is much closer to a
    real terminal-drain metric than timing Python's write() calls alone.
    """

    if not sys.stdin.isatty() or not sys.stdout.isatty():
        return None, "not-a-tty"

    fd = sys.stdin.fileno()
    old = termios.tcgetattr(fd)
    started = time.perf_counter()
    buffer = ""
    try:
        tty.setraw(fd)
        sys.stdout.write("\x1b[6n")
        sys.stdout.flush()

        deadline = started + timeout
        while time.perf_counter() < deadline:
            remaining = max(0.0, deadline - time.perf_counter())
            readable, _, _ = select.select([fd], [], [], min(0.25, remaining))
            if not readable:
                continue
            chunk = os.read(fd, 64).decode("utf-8", "ignore")
            buffer += chunk
            if re.search(r"\x1b\[\d+;\d+R", buffer):
                return time.perf_counter() - started, "ok"
        return None, "timeout"
    except Exception:
        return None, "error"
    finally:
        termios.tcsetattr(fd, termios.TCSADRAIN, old)


def percentile(values: list[float], pct: float) -> float | None:
    if not values:
        return None
    ordered = sorted(values)
    index = min(len(ordered) - 1, max(0, round((pct / 100) * (len(ordered) - 1))))
    return ordered[index]


def summarize_samples(samples: list[dict[str, Any]], elapsed_seconds: float) -> dict[str, Any]:
    cpus = [float(sample["cpu_percent"]) for sample in samples]
    rss = [float(sample["rss_mb"]) for sample in samples]
    avg_cpu = statistics.fmean(cpus) if cpus else None
    return {
        "sample_count": len(samples),
        "app_cpu_avg_percent": avg_cpu,
        "app_cpu_p95_percent": percentile(cpus, 95),
        "app_cpu_max_percent": max(cpus) if cpus else None,
        "app_cpu_core_seconds_est": (avg_cpu / 100 * elapsed_seconds) if avg_cpu is not None else None,
        "app_rss_avg_mb": statistics.fmean(rss) if rss else None,
        "app_rss_peak_mb": max(rss) if rss else None,
    }


def write_samples(path: Path, samples: list[dict[str, Any]]) -> None:
    with path.open("w", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=["ts", "cpu_percent", "rss_mb", "process_count"])
        writer.writeheader()
        writer.writerows(samples)


def run_tier(args: argparse.Namespace) -> Path:
    tier = TIERS[args.tier]
    label = slug(args.label)
    app_pids = infer_app_pids(label, args.process, args.pid)
    run_dir = RESULT_ROOT / f"{now_stamp()}-{label}-{tier.name}"
    run_dir.mkdir(parents=True, exist_ok=True)

    samples: list[dict[str, Any]] = []
    stop = threading.Event()
    sampler: threading.Thread | None = None
    if app_pids:
        sampler = threading.Thread(
            target=sample_processes,
            args=(app_pids, stop, samples, args.sample_interval),
            daemon=True,
        )
        sampler.start()

    battery_start = battery_snapshot()
    start = time.perf_counter()
    lines, byte_count = emit_workload(tier)
    write_done = time.perf_counter()
    dsr_wait_seconds, dsr_status = wait_for_terminal_dsr(tier.drain_timeout_seconds)
    drain_done = time.perf_counter()
    time.sleep(tier.settle_seconds)
    end = time.perf_counter()
    battery_end = battery_snapshot()

    stop.set()
    if sampler:
        sampler.join(timeout=2)

    write_seconds = write_done - start
    terminal_drain_seconds = drain_done - start if dsr_status == "ok" else None
    elapsed_seconds = end - start
    sample_summary = summarize_samples(samples, elapsed_seconds)
    battery_delta = None
    if battery_start["percent"] is not None and battery_end["percent"] is not None:
        battery_delta = battery_end["percent"] - battery_start["percent"]

    summary = {
        "schema": 1,
        "created_at": datetime.now().isoformat(timespec="seconds"),
        "label": label,
        "tier": tier.name,
        "description": tier.description,
        "app_pid": app_pids[0] if app_pids else None,
        "app_pids": app_pids,
        "app_process_inferred": bool(app_pids),
        "lines": lines,
        "bytes": byte_count,
        "output_seconds": write_seconds,
        "write_seconds": write_seconds,
        "terminal_dsr_status": dsr_status,
        "terminal_dsr_wait_seconds": dsr_wait_seconds,
        "terminal_drain_seconds": terminal_drain_seconds,
        "elapsed_seconds_with_settle": elapsed_seconds,
        "settle_seconds": tier.settle_seconds,
        "lines_per_second": lines / write_seconds if write_seconds > 0 else None,
        "write_lines_per_second": lines / write_seconds if write_seconds > 0 else None,
        "terminal_drain_lines_per_second": (
            lines / terminal_drain_seconds if terminal_drain_seconds and terminal_drain_seconds > 0 else None
        ),
        "mb_per_second": (byte_count / 1024 / 1024) / write_seconds if write_seconds > 0 else None,
        "battery_start": battery_start,
        "battery_end": battery_end,
        "battery_delta_percent": battery_delta,
        **sample_summary,
    }

    (run_dir / "summary.json").write_text(json.dumps(summary, indent=2) + "\n")
    write_samples(run_dir / "samples.csv", samples)

    print(f"\n\n== {label} / {tier.name} benchmark ==")
    print(f"results: {run_dir.relative_to(ROOT)}")
    print(f"sampled pids: {', '.join(map(str, app_pids)) if app_pids else 'not inferred'}")
    print(f"output: {lines:,} lines, {byte_count / 1024 / 1024:.1f} MiB")
    print(f"wall: {write_seconds:.2f}s write, {elapsed_seconds:.2f}s including settle")
    print(f"throughput: {summary['lines_per_second']:,.0f} lines/s")
    if terminal_drain_seconds is not None:
        print(
            "terminal drain: "
            f"{terminal_drain_seconds:.2f}s to DSR response "
            f"({summary['terminal_drain_lines_per_second']:,.0f} lines/s)"
        )
    else:
        print(f"terminal drain: {dsr_status} after {tier.drain_timeout_seconds:.0f}s")
    if sample_summary["app_cpu_avg_percent"] is not None:
        print(
            "app samples: "
            f"avg_cpu={sample_summary['app_cpu_avg_percent']:.1f}% "
            f"p95_cpu={sample_summary['app_cpu_p95_percent']:.1f}% "
            f"peak_rss={sample_summary['app_rss_peak_mb']:.0f}MB"
        )
    else:
        print("app samples: unavailable; pass --process or --pid if inference missed the terminal app")
    if battery_delta is not None:
        print(f"battery: {battery_start['percent']}% -> {battery_end['percent']}% ({battery_delta:+d}%)")
    print()

    return run_dir


def run_suite(args: argparse.Namespace) -> None:
    for tier in ("easy", "medium", "heavy"):
        run_args = argparse.Namespace(**vars(args))
        run_args.tier = tier
        run_tier(run_args)
        if tier != "heavy":
            print("Resting 10s before the next tier...")
            time.sleep(10)


def load_summaries() -> list[dict[str, Any]]:
    summaries: list[dict[str, Any]] = []
    for path in sorted(RESULT_ROOT.glob("*/summary.json")):
        try:
            data = json.loads(path.read_text())
        except Exception:
            continue
        data["_path"] = path
        summaries.append(data)
    return summaries


def latest_by_label_and_tier(label: str, tier: str) -> dict[str, Any] | None:
    label = slug(label)
    candidates = [
        item
        for item in load_summaries()
        if item.get("label") == label and item.get("tier") == tier
    ]
    if not candidates:
        return None
    return max(candidates, key=lambda item: str(item.get("created_at", "")))


def fmt_num(value: Any, suffix: str = "", digits: int = 1) -> str:
    if value is None:
        return "n/a"
    if isinstance(value, int):
        return f"{value:,}{suffix}"
    if isinstance(value, float):
        return f"{value:,.{digits}f}{suffix}"
    return str(value)


def compare(args: argparse.Namespace) -> Path:
    a = slug(args.a)
    b = slug(args.b)
    rows = []
    for tier in ("easy", "medium", "heavy"):
        left = latest_by_label_and_tier(a, tier)
        right = latest_by_label_and_tier(b, tier)
        rows.append((tier, left, right))

    lines = [
        f"# Terminal Benchmark Comparison: {a} vs {b}",
        "",
        f"Generated: {datetime.now().isoformat(timespec='seconds')}",
        "",
        "| Tier | Terminal | Write time | Terminal drain | Drain lines/sec | Avg CPU | CPU core-sec est. | Peak RSS | Battery delta | Result path |",
        "| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |",
    ]
    for tier, left, right in rows:
        for item in (left, right):
            if not item:
                lines.append(f"| {tier} | missing | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a |")
                continue
            rel = Path(item["_path"]).parent.relative_to(ROOT)
            drain_status = item.get("terminal_dsr_status")
            drain_seconds = item.get("terminal_drain_seconds")
            if drain_seconds is None and drain_status:
                drain_display = str(drain_status)
            else:
                drain_display = fmt_num(drain_seconds, "s", 2)
            lines.append(
                "| "
                + " | ".join(
                    [
                        tier,
                        item["label"],
                        fmt_num(item.get("write_seconds", item.get("output_seconds")), "s", 2),
                        drain_display,
                        fmt_num(item.get("terminal_drain_lines_per_second"), "", 0),
                        fmt_num(item.get("app_cpu_avg_percent"), "%", 1),
                        fmt_num(item.get("app_cpu_core_seconds_est"), "s", 2),
                        fmt_num(item.get("app_rss_peak_mb"), "MB", 0),
                        fmt_num(item.get("battery_delta_percent"), "%", 0),
                        f"`{rel}`",
                    ]
                )
                + " |"
            )
    lines.extend(
        [
            "",
            "Notes:",
            "- Write time is only Python writing bytes into the PTY. It can look good while the UI is still visibly catching up.",
            "- Terminal drain uses an ANSI Device Status Report after the workload. It measures when the terminal parser consumed the backlog, not a frame-perfect paint timestamp.",
            "- CPU core-seconds are estimated from sampled terminal-app CPU% over output plus settle time.",
            "- Battery deltas are coarse macOS percentage readings and are only meaningful for long repeated runs.",
        ]
    )
    RESULT_ROOT.mkdir(parents=True, exist_ok=True)
    out = RESULT_ROOT / f"comparison-{now_stamp()}-{a}-vs-{b}.md"
    out.write_text("\n".join(lines) + "\n")
    print("\n".join(lines))
    print(f"\ncomparison written: {out.relative_to(ROOT)}")
    return out


def main() -> int:
    parser = argparse.ArgumentParser(description="Compare terminal performance with easy/medium/heavy workloads.")
    sub = parser.add_subparsers(dest="command", required=True)

    run_parser = sub.add_parser("run", help="Run one benchmark tier in the current terminal.")
    run_parser.add_argument("tier", choices=sorted(TIERS), help="Workload tier to run.")
    run_parser.add_argument("--label", required=True, help="Result label, e.g. andspace or ghostty.")
    run_parser.add_argument("--process", help="Terminal app process name to sample, e.g. andspace or Ghostty.")
    run_parser.add_argument("--pid", type=int, help="Exact terminal app PID to sample.")
    run_parser.add_argument("--sample-interval", type=float, default=0.5)

    suite_parser = sub.add_parser("suite", help="Run easy, medium, and heavy tiers.")
    suite_parser.add_argument("--label", required=True, help="Result label, e.g. andspace or ghostty.")
    suite_parser.add_argument("--process", help="Terminal app process name to sample, e.g. andspace or Ghostty.")
    suite_parser.add_argument("--pid", type=int, help="Exact terminal app PID to sample.")
    suite_parser.add_argument("--sample-interval", type=float, default=0.5)

    compare_parser = sub.add_parser("compare", help="Compare latest results for two labels.")
    compare_parser.add_argument("--a", default="andspace")
    compare_parser.add_argument("--b", default="ghostty")

    args = parser.parse_args()
    if args.command == "run":
        run_tier(args)
    elif args.command == "suite":
        run_suite(args)
    elif args.command == "compare":
        compare(args)
    else:
        parser.error("unknown command")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
