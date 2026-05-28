# Command Guard

Command Guard is dry-run only in v0.1 Milestone 4. It evaluates command text
against resolved rules and writes diagnostics, but it does not block, prompt,
open modals, show badges, or hand off to AI.

## Current Flow

1. Shell integration reports command text through the existing OSC lifecycle.
2. The frontend reads the pane cwd and resolved rules for that pane.
3. The frontend calls the Rust `evaluate_command_guard` Tauri command.
4. Rust evaluates the command and logs the result to `/tmp/andspace-diag.log`.
5. The frontend keeps a short in-memory per-pane evaluation history.

This is intentionally passive. Terminal behavior is not interrupted.

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

## Limits

- Dry-run only; no command is blocked yet.
- No confirmation modal or visible Command Guard UI yet.
- No AI handoff yet.
- Matching uses the command text reported by shell integration.
- Aliases, shell expansion, command substitution, shell functions, and resolved
  executable paths are not handled yet.
- This is a safety rail, not a security boundary.
