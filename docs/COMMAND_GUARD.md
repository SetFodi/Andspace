# Command Guard

Command Guard has two v0.1 paths:

- Milestone 4: Rust dry-run evaluator used after shell lifecycle capture.
- Milestone 5: zsh pre-execution proof gate using an `accept-line` widget.
- Milestone 6: hardening and parity checks for the temporary zsh matcher.
- Milestone 7: native AndSpace confirmation UI for protected/dangerous commands.
- Milestone 8: initializer shortcut and small UX hardening.

The zsh gate can stop protected and dangerous commands before execution. It
remains scoped to Command Guard behavior and is separate from AI handoff,
command palette actions, sidebar, project UI, and file exploration.

## Source Of Truth

The Rust resolver and evaluator are canonical for app-side logic, serialized
result shape, and unit tests. The zsh matcher is the current blocking path
because ZLE needs a synchronous decision before accepting the command line.

This duplication is intentional temporary v0.1 architecture. The zsh matcher is
kept small, documented, and covered by parity checks until a Rust-backed
synchronous bridge replaces it.

## Current Flow

Dry-run flow:

1. Shell integration reports command text through the existing OSC lifecycle.
2. The frontend reads the pane cwd and resolved rules for that pane.
3. The frontend calls the Rust `evaluate_command_guard` Tauri command.
4. Rust evaluates the command and logs the result to `/tmp/andspace-diag.log`.

Pre-execution UI flow:

1. zsh `accept-line` checks `$BUFFER`.
2. If the command is protected or dangerous, zsh emits an OSC 9001
   `guard-request`.
3. The frontend stores a pending confirmation and shows a compact overlay.
4. The user chooses cancel/run.
5. Rust writes the action to `/tmp/andspace-guard-<request>.response`.
6. zsh polls that response file and either runs the original command or clears
   `$BUFFER`.

If the UI bridge fails or times out, zsh defaults to cancel.
The frontend also auto-cancels stale confirmations before the shell-side timeout.

Project rules can be bootstrapped with `Cmd+Shift+I`. This creates
`ANDSPACE.md` in the active pane cwd if missing and never overwrites an existing
file.

## zsh Pre-Execution Gate

For zsh panes, `src-tauri/shell-integration/andspace.zsh` wraps the current
`accept-line` ZLE widget. When the user presses Enter, the wrapper inspects
`$BUFFER` before zsh executes it.

Safe and allowed commands execute normally. Protected commands show the native
AndSpace confirmation overlay with:

- title `Protected command`
- command text
- matched rule
- source
- `Cancel` and `Run once`

Dangerous commands show a stronger overlay with:

- title `Dangerous command`
- command text
- matched rule
- source
- exact `run` text input
- `Cancel` and `Run command`

Escape cancels. Dangerous commands cannot run until exact `run` is typed.
While the overlay is open it captures keyboard events, so terminal input should
not leak through to the shell.

Command Guard has top overlay priority. If a confirmation is open, `Cmd+E` and
`Cmd+K` should not take focus.

This milestone uses a small shell-side matcher so the gate can make a
synchronous decision inside ZLE. It intentionally mirrors the Rust matching
order and rule file format, but it is temporary until a Rust-backed synchronous
bridge exists.

The zsh matcher defensively ignores empty rules, comment-only list items, and
invalid regex rules. Invalid regex rules do not block command input.

## Matching

Evaluation order:

1. `Allowed`
2. `Dangerous Commands`
3. `Protected Commands`

Allowed rules suppress protected and dangerous matches. Dangerous matches return
`type-to-confirm` severity. Protected matches return `confirm` severity. If no
rule matches, the result is `safe` with `none` severity.

Substring rules match when the command text contains the rule pattern. Regex
rules use `/regex/` in `ANDSPACE.md` and are evaluated as Rust regex patterns.
Invalid regex patterns do not match.

## Result Shape

The evaluator returns:

- `decision`: `safe`, `allowed`, `protected`, or `dangerous`
- `severity`: `none`, `confirm`, or `type-to-confirm`
- `matchedRule`
- `matchedSource`: `project`, `user`, or `builtin`
- `matchedPatternType`: `substring` or `regex`
- `command`
- `cwd`

## Diagnostic Examples

With this temporary `ANDSPACE.md`:

```md
## Protected Commands
- git push

## Dangerous Commands
- rm -rf

## Allowed
- git push origin feature/test
```

Expected diagnostics:

```text
command-guard pane=p-... decision=safe severity=none cwd=/path command=echo hello
command-guard pane=p-... decision=protected severity=confirm matched_rule=git push matched_source=project matched_pattern_type=substring cwd=/path command=git push
command-guard pane=p-... decision=allowed severity=none matched_rule=git push origin feature/test matched_source=project matched_pattern_type=substring cwd=/path command=git push origin feature/test
command-guard pane=p-... decision=dangerous severity=type-to-confirm matched_rule=rm -rf matched_source=project matched_pattern_type=substring cwd=/path command=rm -rf ./fake-folder
```

Pre-execution gate diagnostics use `command-guard-preexec` and include the user
action:

```text
command-guard-preexec pane=p-... cwd=/path decision=protected severity=confirm matched_rule=echo protected-test matched_source=project matched_pattern_type=substring command=echo protected-test action=cancel
command-guard-preexec pane=p-... cwd=/path decision=dangerous severity=type-to-confirm matched_rule=rm -rf ./fake-folder matched_source=project matched_pattern_type=substring command=rm -rf ./fake-folder action=run
```

Milestone 6 adds `matcher_impl=zsh` to pre-execution diagnostics:

```text
command-guard-preexec pane=p-... cwd=/path matcher_impl=zsh decision=dangerous severity=type-to-confirm matched_rule=rm -rf ./fake-folder matched_source=project matched_pattern_type=substring command=rm -rf ./fake-folder action=cancel
```

Milestone 7 adds UI bridge diagnostics:

```text
command-guard-ui-request pane=p-... request_id=p-... decision=dangerous severity=type-to-confirm matched_rule=rm -rf ./fake-folder matched_source=project command=rm -rf ./fake-folder
command-guard-ui-action pane=p-... request_id=p-... decision=dangerous action=cancel matched_rule=rm -rf ./fake-folder matched_source=project command=rm -rf ./fake-folder
```

Milestone 8 adds initializer diagnostics:

```text
andspace-rules-init cwd=/repo result=created path=/repo/ANDSPACE.md
andspace-rules-init cwd=/repo result=exists path=/repo/ANDSPACE.md
```

## Manual Verification

Use a temporary `ANDSPACE.md` in the repo:

```md
# ANDSPACE.md
<!-- andspace:version 1 -->

## Protected Commands
- echo protected-test

## Dangerous Commands
- echo dangerous-test
- rm -rf ./fake-folder

## Allowed
- echo protected-test allowed
```

Then in AndSpace:

```bash
echo hello
echo protected-test
echo protected-test allowed
echo dangerous-test
mkdir -p fake-folder
rm -rf ./fake-folder
test -d fake-folder && echo "folder still exists"
```

Expected behavior:

- `echo hello` runs normally.
- `echo protected-test` opens the UI; cancel prevents execution.
- Running `echo protected-test` again and choosing `Run once` executes it.
- `echo protected-test allowed` runs normally.
- `echo dangerous-test` opens the UI; exact `run` is required to execute.
- `rm -rf ./fake-folder` opens the UI; cancel leaves the folder, exact `run`
  removes it.

The automated dev verification script runs the same fixture through the direct
zsh matcher and a controlling-PTY ZLE flow:

```bash
scripts/verify-command-guard-zsh.sh
```

For initializer verification:

1. In a pane with a cwd, press `Cmd+Shift+I`.
2. Confirm `ANDSPACE.md` appears.
3. Press `Cmd+Shift+I` again and confirm the file is not overwritten.
4. Add test rules and verify protected/dangerous/allowed overlay behavior.

## Overlay priority

Command Guard is the **highest priority overlay**. While a guard confirmation
is pending:

- All `Cmd`-shortcuts are ignored (`Cmd+K`, `Cmd+E`, `Cmd+B`, `Cmd+/`, etc.).
- No other overlay can open. The Keyboard Shortcuts overlay, Command Palette,
  AI Handoff, File Actions, and Go to File overlays all check
  `!pendingGuardConfirmation` before rendering.
- The terminal stops accepting input until the user responds (Allow / Deny)
  or the 60 s timeout fires.
- Pressing Escape sends `cancel` to the guard so the protected command is
  not executed. Closing the overlay never silently allows the command.

## Limits

- Pre-execution blocking is zsh only.
- The native confirmation overlay is intentionally small and Command Guard-only.
- AI handoff and command palette do not bypass Command Guard.
- Matching uses the command text reported by shell integration.
- The zsh pre-execution gate matches `$BUFFER` before execution.
- Dangerous commands default to cancel on UI failure or timeout.
- zsh is still the only fully supported shell integration.
- There is no settings UI or write-capable Git client. Read-only Git Changes,
  sidebar file actions, and script launch remain separate from Command Guard.
- Rust is canonical for app-side matching; zsh matching is temporary for
  blocking.
- Aliases, shell expansion, command substitution, shell functions, and resolved
  executable paths are not handled yet.
- Scripts and Makefiles can hide dangerous commands internally.
- This is a safety rail, not a security sandbox or security boundary.
