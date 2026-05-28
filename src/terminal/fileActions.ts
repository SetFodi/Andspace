import { invoke } from "@tauri-apps/api/core";
import type { ProjectTree, ProjectTreeNode } from "./projectSidebarData";

export interface AvailableEditors {
  cursor: boolean;
  code: boolean;
  nvim: boolean;
  vim: boolean;
}

export interface ResolvedProjectRoot {
  cwd: string;
  root: string;
  marker: string | null;
}

export type FileAction =
  | { type: "open"; tool: "cursor" | "code"; label: string }
  | { type: "nvim-split"; label: string }
  | { type: "copy"; label: string }
  | { type: "reveal"; label: string };

export function resolveProjectRoot(cwd: string): Promise<ResolvedProjectRoot> {
  return invoke<ResolvedProjectRoot>("resolve_project_root", { cwd });
}

export function detectExternalEditors(): Promise<AvailableEditors> {
  return invoke<AvailableEditors>("detect_external_editors");
}

export function openInExternalEditor(
  tool: "cursor" | "code",
  path: string
): Promise<void> {
  return invoke("open_in_external_editor", { tool, path });
}

export function revealInFinder(path: string): Promise<void> {
  return invoke("reveal_in_finder", { path });
}

export function buildNvimSplitCommand(path: string): Promise<string> {
  return invoke<string>("build_nvim_split_command", { path });
}

export function reportFileActionEvent(
  event: "copy" | "nvim-split" | "file-picker-open" | "file-picker-select",
  options: { target?: string; path?: string } = {}
): Promise<void> {
  return invoke("report_file_action_event", {
    event,
    target: options.target ?? "",
    path: options.path ?? "",
  });
}

/// Build the list of actions available for a file given which editors are
/// detected. Cursor/Code/Nvim entries only appear when the tool is on PATH;
/// Copy/Reveal are always present. Order matches the menu the user sees.
export function actionsForFile(editors: AvailableEditors): FileAction[] {
  const actions: FileAction[] = [];
  if (editors.cursor) {
    actions.push({ type: "open", tool: "cursor", label: "Open in Cursor" });
  }
  if (editors.code) {
    actions.push({ type: "open", tool: "code", label: "Open in VS Code" });
  }
  if (editors.nvim) {
    actions.push({ type: "nvim-split", label: "Open in Neovim split" });
  }
  actions.push({ type: "copy", label: "Copy path" });
  actions.push({ type: "reveal", label: "Reveal in Finder" });
  return actions;
}

/// Default action used by Cmd+Enter. Cursor > Code > Neovim > Copy.
/// Returns the action that should run immediately, never null.
export function defaultActionFor(editors: AvailableEditors): FileAction {
  if (editors.cursor) {
    return { type: "open", tool: "cursor", label: "Open in Cursor" };
  }
  if (editors.code) {
    return { type: "open", tool: "code", label: "Open in VS Code" };
  }
  if (editors.nvim) {
    return { type: "nvim-split", label: "Open in Neovim split" };
  }
  return { type: "copy", label: "Copy path" };
}

/// Substring-match search across a flattened file list. Case-insensitive.
/// Files matching the full path get scored, with name matches preferred
/// over path-segment matches so `nav` ranks `Navbar.tsx` above
/// `components/foo/n-bar.ts`.
export interface PickerEntry {
  name: string;
  path: string;
  parent: string;
}

export function flattenTreeFiles(tree: ProjectTree | null): PickerEntry[] {
  if (!tree) return [];
  const out: PickerEntry[] = [];
  const walk = (node: ProjectTreeNode) => {
    if (node.kind === "file") {
      const lastSlash = node.path.lastIndexOf("/");
      const parent = lastSlash >= 0 ? node.path.slice(0, lastSlash) : "";
      out.push({ name: node.name, path: node.path, parent });
      return;
    }
    for (const child of node.children ?? []) {
      walk(child);
    }
  };
  walk(tree.root);
  return out;
}

export function filterPickerEntries(
  entries: PickerEntry[],
  query: string
): PickerEntry[] {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return entries.slice(0, 200);
  const scored = entries
    .map((entry) => {
      const nameLower = entry.name.toLowerCase();
      const pathLower = entry.path.toLowerCase();
      const nameIdx = nameLower.indexOf(trimmed);
      const pathIdx = pathLower.indexOf(trimmed);
      if (nameIdx === -1 && pathIdx === -1) return null;
      // Lower score wins. Name matches are stronger than path matches.
      const score = nameIdx === -1 ? 1000 + pathIdx : nameIdx;
      return { entry, score };
    })
    .filter((x): x is { entry: PickerEntry; score: number } => x !== null);
  scored.sort((a, b) => a.score - b.score || a.entry.name.localeCompare(b.entry.name));
  return scored.slice(0, 200).map((x) => x.entry);
}
