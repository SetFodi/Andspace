# AI Handoff

Milestone 9 added the foundation for `⌘E` handoff. The v0.1 sprint extends it
to local CLI handoff for installed tools only. There is no provider API
integration, API key management, provider billing, chat history, streaming
response, or settings UI.

The current flow is capture → redact → prompt → copy/preview/send to local CLI.

## Capture

When shell integration reports command start for a pane, AndSpace begins an
in-memory output capture for that pane. When command end arrives, the capture is
closed and stored with the last command record.

Output capture is bounded:

- default prompt output is the last 80 lines
- captured text has a hard byte cap before it is stored
- only a short per-pane handoff history is kept
- nothing is persisted to disk

The terminal rendering path is unchanged. PTY output still goes straight to
xterm.js; handoff capture keeps only a small text tail for the active command.

## Redaction

Prompt redaction is on by default before copy or preview.

Current redaction covers:

- env-style secret names containing `KEY`, `TOKEN`, `SECRET`, `PASSWORD`,
  `PRIVATE`, or `CREDENTIAL`
- obvious `.env` assignment lines
- AWS access keys matching `AKIA[0-9A-Z]{16}`
- bearer tokens matching `Bearer <token>`

Redaction is best-effort safety hygiene, not a security boundary.

## Prompt Shape

The generated prompt includes:

- cwd
- last command
- exit code
- recent output
- selected terminal text, when available
- `ANDSPACE.md` Project Context, when available
- fixed rules telling the recipient not to run git add/commit/push unless
  explicitly asked, and to explain risky/destructive commands first

If no completed command or output is available, the prompt uses a clear fallback
instead of failing.

## Local CLI Handoff

AndSpace detects local tools with PATH lookup:

- `claude` for Claude Code
- `codex` for Codex
- `cursor-agent` for Cursor CLI

Missing tools are disabled in the overlay. AndSpace does not check API keys and
does not call Anthropic, OpenAI, or Cursor APIs directly.

When sending to a CLI, AndSpace writes the redacted prompt to a temporary file,
opens a split-right pane, and runs the selected CLI with stdin redirected from
that file. The shell command includes only the temp file path, not the prompt
body, so the prompt is not written into shell history.

## UI

Press `Cmd+E` to open a compact `Send context` overlay. It includes:

- `Copy prompt`
- `Preview prompt`
- `Send to Claude`
- `Send to Codex`
- `Send to Cursor`
- `Cancel`

`Preview prompt` shows the redacted prompt in a scrollable panel. `Copy prompt`
copies the same redacted prompt to the clipboard. Send buttons launch only local
installed CLIs. Escape closes the overlay and returns focus to the terminal.

The handoff overlay sits below Command Guard in the priority stack — if Guard
is waiting for confirmation, `Cmd+E` is suppressed. While the handoff overlay
is open, no other overlay can open and `Cmd`-shortcuts are inactive until it
closes.

## Diagnostics

Diagnostics are written to `/tmp/andspace-diag.log`:

```text
handoff-open pane=p-... command=echo hello exit_code=0 output_line_count=1 redaction_count=0
handoff-preview pane=p-... command=echo hello exit_code=0 output_line_count=1 redaction_count=0
handoff-copy pane=p-... command=echo hello exit_code=0 output_line_count=1 redaction_count=0
handoff-send pane=p-... command=echo hello exit_code=0 output_line_count=1 redaction_count=0 target=claude
handoff-send-success pane=p-... command=echo hello exit_code=0 output_line_count=1 redaction_count=0 target=claude
handoff-send-error pane=p-... command=echo hello exit_code=0 output_line_count=1 redaction_count=0 target=codex error=...
```

## Manual Verification

1. Run `echo hello`.
2. Press `Cmd+E`.
3. Preview the prompt and confirm cwd, command, exit code, and output appear.
4. Copy the prompt and paste it somewhere safe.
5. Run `false`, press `Cmd+E`, and confirm `Exit code: 1`.
6. Run `echo "API_KEY=abc123 Bearer test.token.value"`.
7. Press `Cmd+E` and confirm the secret values are redacted.
8. If a supported CLI is installed, click its send button and confirm a
   split-right pane opens with the CLI launched from a temp prompt file.

## Limits

- Local CLI launch only; no direct provider API calls.
- No multi-CLI fanout or answer comparison.
- Captured output is terminal text, not a structured process transcript.
- Redaction can miss novel secret formats.
- Command Guard remains separate from handoff.
- zsh is still the only fully supported shell integration.
