import { invoke } from "@tauri-apps/api/core";

export type GitFileStatus =
  | "modified"
  | "added"
  | "deleted"
  | "renamed"
  | "untracked";

export interface GitChangedFile {
  path: string;
  oldPath?: string | null;
  status: GitFileStatus;
  rawStatus: string;
}

export interface GitStatus {
  isRepo: boolean;
  repoRoot?: string | null;
  branch?: string | null;
  files: GitChangedFile[];
}

export interface GitDiffPreview {
  repoRoot: string;
  path: string;
  oldPath?: string | null;
  status: GitFileStatus;
  rawStatus: string;
  branch?: string | null;
  diff: string;
  tooLarge: boolean;
  message?: string | null;
  bytes: number;
}

export function loadGitStatus(cwd: string): Promise<GitStatus> {
  return invoke<GitStatus>("load_git_status", { cwd });
}

export function loadGitDiff(
  cwd: string,
  file: GitChangedFile
): Promise<GitDiffPreview> {
  return invoke<GitDiffPreview>("load_git_diff", { cwd, file });
}

export function reportGitEvent(
  event:
    | "git-refresh"
    | "git-file-open"
    | "git-status-error"
    | "git-diff-copy",
  options: { cwd?: string; path?: string } = {}
): Promise<void> {
  return invoke("report_git_event", {
    event,
    cwd: options.cwd ?? null,
    path: options.path ?? null,
  });
}

export function gitStatusLabel(status: GitFileStatus): string {
  if (status === "modified") return "modified";
  if (status === "added") return "added";
  if (status === "deleted") return "deleted";
  if (status === "renamed") return "renamed";
  return "untracked";
}

export function shortGitPath(path: string): string {
  const parts = path.split("/");
  if (parts.length <= 3) return path;
  return `${parts[0]}/…/${parts.slice(-2).join("/")}`;
}

export function absoluteGitPath(repoRoot: string | null | undefined, path: string): string {
  if (!repoRoot) return path;
  return `${repoRoot.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
}
