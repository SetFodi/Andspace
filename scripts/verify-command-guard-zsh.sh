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
import uuid
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
        "HOME": str(work),
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
    ready = f"ANDSPACE_READY_{uuid.uuid4().hex}"
    env.update({
        "HOME": str(work),
        "TERM": "xterm-256color",
        "TERM_PROGRAM": "AndSpace",
        "ANDSPACE_SHELL_INTEGRATION": "1",
        "ANDSPACE_PANE_ID": "verify-zle",
        "ANDSPACE_GUARD_RESPONSE_TIMEOUT_MS": "5000",
        "ANDSPACE_VERIFY_READY": ready,
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
            if token in buffer:
                idx = buffer.index(token) + len(token)
                out, buffer = buffer[:idx], buffer[idx:]
                return out
            ready, _, _ = select.select([master], [], [], 0.1)
            if master in ready:
                buffer += os.read(master, 4096).decode("utf-8", "replace")
                if token in buffer:
                    idx = buffer.index(token) + len(token)
                    out, buffer = buffer[:idx], buffer[idx:]
                    return out
        raise TimeoutError(f"timed out waiting for {token!r}; buffer={buffer!r}")

    def send(text):
        os.write(master, text.encode())

    def next_guard_request():
        nonlocal buffer
        out = read_until("guard-request|", 5)
        rest = read_until("\x1b\\", 5)
        payload = (out + rest).split("guard-request|", 1)[1].split("\x1b\\", 1)[0]
        request_id = payload.split("|", 1)[0]
        buffer = ""
        return request_id

    def respond(request_id, action):
        Path(f"/tmp/andspace-guard-{request_id}.response").write_text(action)

    def wait_prompt(timeout=5):
        nonlocal buffer
        out = read_until("PROMPT> ", timeout)
        buffer = ""
        return out

    def assert_contains(label, haystack, needle):
        if needle not in haystack:
            raise AssertionError(f"{label}: expected {needle!r} in {haystack!r}")

    try:
        send(f"PS1='PROMPT> '; source {integration}; print -r -- \"$ANDSPACE_VERIFY_READY\"\n")
        read_until(ready)
        wait_prompt()

        send("echo hello\n")
        assert_contains("safe command", wait_prompt(), "hello")

        send("echo protected-test\n")
        respond(next_guard_request(), "cancel")
        assert_contains(
            "protected ui cancel",
            wait_prompt(),
            "AndSpace canceled command.",
        )

        send("echo protected-test\n")
        respond(next_guard_request(), "run")
        assert_contains("protected ui run", wait_prompt(), "protected-test")

        send("echo protected-test allowed\n")
        assert_contains("allowed command", wait_prompt(), "protected-test allowed")

        send("echo dangerous-test\n")
        respond(next_guard_request(), "cancel")
        assert_contains(
            "dangerous ui cancel",
            wait_prompt(),
            "AndSpace canceled command.",
        )

        send("echo dangerous-test\n")
        respond(next_guard_request(), "run")
        assert_contains("dangerous ui run", wait_prompt(), "dangerous-test")

        send("mkdir -p fake-folder\n")
        wait_prompt()
        send("rm -rf ./fake-folder\n")
        respond(next_guard_request(), "cancel")
        assert_contains(
            "destructive ui cancel",
            wait_prompt(),
            "AndSpace canceled command.",
        )
        if not (work / "fake-folder").is_dir():
            raise AssertionError("destructive cancel removed fake-folder")

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
