# ANDSPACE Rules

AndSpace v0.1 loads command safety rules as data for Command Guard. Milestone 4
evaluates these rules in dry-run mode only: no prompts, modals, blocking,
sidebars, AI handoff UI, or command palette features.

## File Locations

Rules are loaded for the active pane cwd through the `load_rules_for_cwd` Tauri
command:

- Project rules: `./ANDSPACE.md`
- User-global rules: `~/.andspace/rules.md`
- Built-in defaults: compiled into `src-tauri/src/rules.rs`

The frontend requests resolved rules for the active pane cwd and stores them in
memory only.

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

Rules use Markdown list items only:

```md
## Protected Commands
- git push --force
- /kubectl\s+delete/

## Dangerous Commands
- DROP TABLE

## Allowed
- git push --force-with-lease # this comment is ignored
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
- Project lookup is `cwd/ANDSPACE.md`; it does not walk parent directories yet.
- Command Guard catches what shell integration reports as command text.
- Command Guard is a safety rail, not a security boundary.
