#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
INTEGRATION="$ROOT/src-tauri/shell-integration/andspace.zsh"

python3 - "$ROOT" "$INTEGRATION" <<'PY'
import os
import pty
import select
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path

root = Path(sys.argv[1])
integration = Path(sys.argv[2])

fixture = """# ANDSPACE.md
<!-- andspace:version 1 -->

## Protected Commands
- echo protected-test
- overlap
- /kubectl\\s+delete/
- /[/
-    
- # comment-only rule

## Dangerous Commands
- echo dangerous-test
- rm -rf ./fake-folder
- overlap command

## Allowed
- echo protected-test allowed
- overlap command allowed
"""

expected_direct = [
    ("echo hello", "safe", "none", ""),
    ("echo protected-test", "protected", "confirm", "echo protected-test"),
    ("echo protected-test allowed", "allowed", "none", "echo protected-test allowed"),
    ("echo dangerous-test", "dangerous", "type-to-confirm", "echo dangerous-test"),
    ("rm -rf ./fake-folder", "dangerous", "type-to-confirm", "rm -rf ./fake-folder"),
    ("overlap command", "dangerous", "type-to-confirm", "overlap command"),
    ("overlap command allowed", "allowed", "none", "overlap command allowed"),
    ("kubectl delete pod api", "protected", "confirm", "kubectl\\s+delete"),
]


def make_workspace():
    work = Path(tempfile.mkdtemp(prefix="andspace-guard-"))
    (work / "ANDSPACE.md").write_text(fixture)
    return work


def run_direct_matcher(work):
    script = [
        f"cd {quote(str(work))}",
        f"source {quote(str(integration))}",
    ]
    for command, *_ in expected_direct:
        script.append(f"__andspace_guard_evaluate {quote(command)}")

    env = os.environ.copy()
    env.update({
        "TERM_PROGRAM": "AndSpace",
        "ANDSPACE_SHELL_INTEGRATION": "1",
        "ANDSPACE_PANE_ID": "verify-direct",
    })
    result = subprocess.run(
        ["/bin/zsh", "-fc", "; ".join(script)],
        cwd=root,
        env=env,
        text=True,
        capture_output=True,
        check=True,
    )
    lines = [line.split("\t") for line in result.stdout.splitlines()]
    if len(lines) != len(expected_direct):
        raise AssertionError(f"expected {len(expected_direct)} matcher lines, got {len(lines)}: {result.stdout!r}")

    for (command, decision, severity, matched), parts in zip(expected_direct, lines):
        actual = parts + [""] * (5 - len(parts))
        if actual[0] != decision or actual[1] != severity or actual[2] != matched:
            raise AssertionError(
                f"{command!r}: expected {(decision, severity, matched)!r}, got {tuple(actual[:3])!r}"
            )


def run_zle_gate(work):
    env = os.environ.copy()
    env.update({
        "TERM": "xterm-256color",
        "TERM_PROGRAM": "AndSpace",
        "ANDSPACE_SHELL_INTEGRATION": "1",
        "ANDSPACE_PANE_ID": "verify-zle",
    })

    pid, master = pty.fork()
    if pid == 0:
        os.chdir(work)
        os.environ.clear()
        os.environ.update(env)
        os.execv("/bin/zsh", ["/bin/zsh", "-f"])

    buffer = ""

    def read_until(token, timeout=5):
        nonlocal buffer
        deadline = time.time() + timeout
        while time.time() < deadline:
            ready, _, _ = select.select([master], [], [], 0.1)
            if master in ready:
                buffer += os.read(master, 4096).decode("utf-8", "replace")
                if token in buffer:
                    out, buffer = buffer, ""
                    return out
        raise TimeoutError(f"timed out waiting for {token!r}; buffer={buffer!r}")

    def send(text):
        os.write(master, text.encode())

    try:
        send(f"PS1='PROMPT> '; source {integration}; echo READY\n")
        assert "READY" in read_until("PROMPT> ")

        send("echo hello\n")
        assert "hello" in read_until("PROMPT> ")

        send("echo protected-test\n")
        assert "Run once? [y/N]" in read_until("Run once? [y/N]")
        send("n\n")
        assert "AndSpace canceled command." in read_until("PROMPT> ")

        send("echo protected-test allowed\n")
        assert "protected-test allowed" in read_until("PROMPT> ")

        send("echo dangerous-test\n")
        assert "Type run to continue:" in read_until("Type run to continue:")
        send("run\n")
        assert "dangerous-test" in read_until("PROMPT> ")

        send("mkdir -p fake-folder\n")
        read_until("PROMPT> ")
        send("rm -rf ./fake-folder\n")
        assert "Type run to continue:" in read_until("Type run to continue:")
        send("no\n")
        assert "AndSpace canceled command." in read_until("PROMPT> ")

        send('test -d fake-folder && echo "folder still exists"\n')
        assert "folder still exists" in read_until("PROMPT> ")
    finally:
        try:
            send("exit\n")
        except OSError:
            pass
        try:
            os.close(master)
        except OSError:
            pass


def quote(value):
    return "'" + value.replace("'", "'\\''") + "'"


work = make_workspace()
try:
    run_direct_matcher(work)
    run_zle_gate(work)
finally:
    shutil.rmtree(work, ignore_errors=True)

print("command guard zsh verification passed")
PY
