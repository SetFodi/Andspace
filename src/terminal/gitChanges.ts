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

export function loadGitStatus(cwd: string): Promise<GitStatus> {
  return invoke<GitStatus>("load_git_status", { cwd });
}

export function reportGitEvent(
  event: "git-refresh" | "git-file-open" | "git-status-error",
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
