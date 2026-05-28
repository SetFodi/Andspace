# Command Guard

Command Guard has two v0.1 paths:

- Milestone 4: Rust dry-run evaluator used after shell lifecycle capture.
- Milestone 5: zsh pre-execution proof gate using an `accept-line` widget.

The zsh gate can stop protected and dangerous commands before execution, but it
is still not the final product UI: no modal, sidebar, command palette, project
UI, or AI handoff.

## Current Flow

1. Shell integration reports command text through the existing OSC lifecycle.
2. The frontend reads the pane cwd and resolved rules for that pane.
3. The frontend calls the Rust `evaluate_command_guard` Tauri command.
4. Rust evaluates the command and logs the result to `/tmp/andspace-diag.log`.
5. The frontend keeps a short in-memory per-pane evaluation history.

This is intentionally passive. Terminal behavior is not interrupted.

## zsh Pre-Execution Gate

For zsh panes, `src-tauri/shell-integration/andspace.zsh` wraps the current
`accept-line` ZLE widget. When the user presses Enter, the wrapper inspects
`$BUFFER` before zsh executes it.

Safe and allowed commands execute normally. Protected commands show:

```text
AndSpace protected command: <matched rule>. Run once? [y/N]
```

Only `y` runs the command. Any other input cancels it.

Dangerous commands show:

```text
AndSpace dangerous command: <matched rule>. Type run to continue:
```

Only exact `run` executes the command. Any other input cancels it.

This milestone uses a small shell-side matcher so the gate can make a
synchronous decision inside ZLE. It intentionally mirrors the Rust matching
order and rule file format, but it is temporary until a Rust-backed synchronous
bridge exists.

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
- `echo protected-test` prompts before execution.
- `echo protected-test allowed` runs normally.
- `echo dangerous-test` requires typing `run`.
- `rm -rf ./fake-folder` requires typing `run`; if canceled, the folder remains.

## Limits

- Pre-execution blocking is zsh only.
- No final confirmation modal or visible Command Guard UI yet.
- No AI handoff yet.
- Matching uses the command text reported by shell integration.
- The zsh pre-execution gate matches `$BUFFER` before execution.
- Aliases, shell expansion, command substitution, shell functions, and resolved
  executable paths are not handled yet.
- Scripts and Makefiles can hide dangerous commands internally.
- This is a safety rail, not a security boundary.
