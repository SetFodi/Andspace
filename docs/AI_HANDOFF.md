# AI Handoff

Milestone 9 adds the foundation for `⌘E` handoff. It does not launch Claude,
Codex, Cursor, or any other AI CLI yet. There is no provider integration, chat
history, streaming response, sidebar, command palette, file explorer, or
settings UI.

The current flow is capture → redact → prompt → copy/preview.

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

## UI

Press `Cmd+E` to open a compact `Send context` overlay. For Milestone 9 it has
only:

- `Copy prompt`
- `Preview prompt`
- `Cancel`

`Preview prompt` shows the redacted prompt in a scrollable panel. `Copy prompt`
copies the same redacted prompt to the clipboard. Escape closes the overlay.

## Diagnostics

Diagnostics are written to `/tmp/andspace-diag.log`:

```text
handoff-open pane=p-... command=echo hello exit_code=0 output_line_count=1 redaction_count=0
handoff-preview pane=p-... command=echo hello exit_code=0 output_line_count=1 redaction_count=0
handoff-copy pane=p-... command=echo hello exit_code=0 output_line_count=1 redaction_count=0
```

## Manual Verification

1. Run `echo hello`.
2. Press `Cmd+E`.
3. Preview the prompt and confirm cwd, command, exit code, and output appear.
4. Copy the prompt and paste it somewhere safe.
5. Run `false`, press `Cmd+E`, and confirm `Exit code: 1`.
6. Run `echo "API_KEY=abc123 Bearer test.token.value"`.
7. Press `Cmd+E` and confirm the secret values are redacted.

## Limits

- Copy/preview only; no AI process is launched.
- No provider buttons yet.
- Captured output is terminal text, not a structured process transcript.
- Redaction can miss novel secret formats.
- Command Guard remains separate from handoff.
