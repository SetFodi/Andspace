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

Git Changes follows the active terminal pane / tab. When focus moves to a pane
in another repository, the section switches to that pane's repo only.

Git status loads when the sidebar opens, refreshes when Git Changes is focused,
refreshes after the active pane's foreground command ends, and refreshes when
the app regains focus. The section also has a small refresh button, and the
command palette includes **Refresh Git Changes**.

## Diff Preview

Clicking a changed file opens a compact read-only diff preview. The preview
shows the path, status label, branch, diff content, and actions to copy the
diff or open the file through the existing external-editor handoff.

The diff preview is intentionally not an editor. It does not support staging,
discarding, applying patches, committing, branch switching, push, pull, stash,
reset, checkout, merge, or rebase.

Read-only commands used for preview:

```text
git diff -- <file>
git diff --cached -- <file>
```

`git diff --cached` is used only when the porcelain status indicates a staged
change. Untracked files show:

```text
Untracked file — no git diff yet. Open file instead.
```

Diff output is capped at 300 KB. Larger diffs show:

```text
Diff too large to preview. Open in external editor.
```

Right-click or `Cmd+Enter` on a changed file opens File Actions instead of the
diff preview.

## Command Palette

`Cmd+K` includes:

| Action | Behavior |
| --- | --- |
| Focus Git Changes | Opens the sidebar focused on Git Changes |
| Refresh Git Changes | Refreshes the sidebar Git status |
| Open Git Diff | Opens a read-only diff for the selected / first changed file |
| Copy Git Diff | Copies the selected / first changed file's diff |
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
git-diff-load path=src/App.tsx result=ok bytes=1234
git-diff-too-large path=big.json bytes=420000
git-diff-error path=src/App.tsx
git-diff-copy path=/repo/src/App.tsx
```

## Tests

Rust tests cover:

- Porcelain status parsing.
- Branch parsing.
- Status label mapping.
- Repo-root walking.
- No-repo fallback.
- Diff command selection.
- Untracked diff fallback.
- Large diff cap behavior.
