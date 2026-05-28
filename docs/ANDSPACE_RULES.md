# ANDSPACE Rules

AndSpace v0.1 loads command safety rules as data for Command Guard. The zsh
pre-execution gate and compact confirmation overlay are active, but there is no
sidebar, command palette, settings UI, file explorer, or AI handoff.

## File Locations

Rules are loaded for the active pane cwd through the `load_rules_for_cwd` Tauri
command:

- Project rules: `./ANDSPACE.md`
- User-global rules: `~/.andspace/rules.md`
- Built-in defaults: compiled into `src-tauri/src/rules.rs`

The frontend requests resolved rules for the active pane cwd and stores them in
memory only.

## Initializing A Project

Press `Cmd+Shift+I` in an active pane to create `ANDSPACE.md` in that pane's
current working directory. The initializer never overwrites an existing file.

Results are shown as a small toast:

- `created`: wrote a new `ANDSPACE.md`
- `exists`: left the existing `ANDSPACE.md` untouched
- `error`: failed to create the file

Initializer diagnostics are written to `/tmp/andspace-diag.log`:

```text
andspace-rules-init cwd=/repo result=created path=/repo/ANDSPACE.md
andspace-rules-init cwd=/repo result=exists path=/repo/ANDSPACE.md
andspace-rules-init cwd=/repo result=error path=/repo/ANDSPACE.md error=...
```

The generated template includes all recognized sections, short comments for how
to use them, and the version marker:

```md
# ANDSPACE.md
<!-- andspace:version 1 -->
```

## Source Of Truth

`src-tauri/src/rules.rs` and `src-tauri/src/command_guard.rs` are canonical for
app-side rule resolution, matching behavior, result shape, and tests.

`src-tauri/shell-integration/andspace.zsh` contains a temporary shell-side
matcher because the current zsh blocking gate needs a synchronous answer inside
ZLE. That duplication is intentional for v0.1 and is covered by parity tests and
`scripts/verify-command-guard-zsh.sh`.

## Precedence

Rules are merged in this order:

1. Project rules from `./ANDSPACE.md`
2. User-global rules from `~/.andspace/rules.md`
3. Built-in defaults

Higher-precedence sources come first. Identical rules in the same category keep
the highest-precedence source, so project overrides user and user overrides
built-in defaults.

Allowed rules suppress protected or dangerous matches during Command Guard
evaluation.

## Recognized Sections

Section names are matched case-insensitively. Unknown sections are ignored.

- `## Protected Commands`
- `## Dangerous Commands`
- `## Allowed`
- `## AI Handoff`
- `## Project Context`

Protected rules resolve with `confirm` severity. Dangerous rules resolve with
`type-to-confirm` severity. Allowed rules have no severity.

Command Guard checks `Allowed` first, then `Dangerous Commands`, then
`Protected Commands`.

## Rule Format

Rules use Markdown list items only. The initializer writes a starter template
like this:

```md
# ANDSPACE.md
<!-- andspace:version 1 -->

## Protected Commands
<!-- Commands that should ask for confirmation before running. One rule per list item. -->
- git push --force
- npm publish
- pnpm publish

## Dangerous Commands
- rm -rf /
- DROP TABLE
- dropdb

## Allowed
- git push --force-with-lease # this comment is ignored

## AI Handoff
- Include cwd, command, exit code, and recent terminal output.

## Project Context
Describe what this project does and any local safety constraints.
```

Normal rules use substring matching. Regex rules use `/regex/` form. The parser
does not validate regex syntax yet; it stores the pattern for the future guard
path.

`## AI Handoff` accepts list items or plain text lines:

```md
## AI Handoff
- include cwd, command, exit code, and recent output
```

`## Project Context` preserves non-empty text lines as a project context block:

```md
## Project Context
This project is a Tauri terminal prototype.
Keep v0.1 scoped to foundation work.
```

## Built-In Defaults

Protected defaults:

- `git push --force`
- `git push -f`
- `sudo`
- `npm publish`
- `pnpm publish`
- `yarn publish`
- `vercel --prod`
- `supabase db push`
- `pm2 restart`

Dangerous defaults:

- `rm -rf /`
- `DROP TABLE`
- `dropdb`

## Parser Limitations

- No YAML or JSON front matter.
- Only `##` headings are recognized.
- Unknown sections are ignored.
- List items must start with `- `, `* `, or `+ `.
- Inline comments start at `#`.
- Regex flags are not supported.
- Aliases, shell functions, shell expansion, command substitution, and resolved
  executable paths are not handled yet.
- Scripts and Makefiles can hide dangerous commands internally.
- Project lookup is `cwd/ANDSPACE.md`; it does not walk parent directories yet.
- Command Guard catches what shell integration reports as command text.
- Command Guard is a safety rail, not a security sandbox or security boundary.
