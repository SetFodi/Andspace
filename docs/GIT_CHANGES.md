# Git Changes

AndSpace v0.1 includes a lightweight, read-only Git Changes section in the
project sidebar.

## Scope

Git Changes is intentionally not a Git client. It only shows repository state:

- Current branch.
- Changed file count.
- Changed files.
- Status labels: `modified`, `added`, `deleted`, `renamed`, `untracked`.

It does not provide commit, push, pull, merge, rebase, checkout, reset, stash,
or staging actions.

## Detection

AndSpace starts from the current project root / active pane cwd and walks upward
until it finds `.git`. If no repository is found, the section shows a small
empty state.

## Status Source

The only Git command used by this panel is read-only:

```text
git status --porcelain=v1 -b
```

AndSpace does not run `git add`, `git commit`, `git push`, `git pull`,
`git reset`, `git checkout`, or `git stash`.

## Refresh

There is no polling and no background Git watcher.

Git status loads when the sidebar opens and refreshes when the Git Changes
section is focused. The section also has a small refresh button, and the
command palette includes **Refresh Git Changes**.

## Opening Files

Clicking a changed file opens the existing File Actions overlay for that path.
There is no diff viewer or editor in v0.1.

## Command Palette

`Cmd+K` includes:

| Action | Behavior |
| --- | --- |
| Focus Git Changes | Opens the sidebar focused on Git Changes |
| Refresh Git Changes | Refreshes the sidebar Git status |
| Open Changed File | Opens File Actions for the first changed file |

## Command Guard

Risky Git commands remain protected by Command Guard. The Git Changes panel is
read-only and does not bypass Command Guard.

## Diagnostics

Git events are written to `/tmp/andspace-diag.log`:

```text
git-status-load cwd=/repo result=ok repo=/repo files=3
git-status-load cwd=/repo result=no-repo
git-status-error cwd=/repo error=...
git-file-open path=/repo/src/App.tsx
git-refresh
```

## Tests

Rust tests cover:

- Porcelain status parsing.
- Branch parsing.
- Status label mapping.
- Repo-root walking.
- No-repo fallback.
