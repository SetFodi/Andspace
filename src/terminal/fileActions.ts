import { invoke } from "@tauri-apps/api/core";
import type { ProjectTree, ProjectTreeNode } from "./projectSidebarData";
import type { DefaultFileAction } from "./preferencesModel";

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
  | {
      type: "open";
      tool: "cursor" | "code";
      label: string;
      disabled?: boolean;
    }
  | { type: "nvim-split"; label: string; disabled?: boolean }
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

/// Build the list of actions available for a file. All editor entries are
/// always shown so users can see what AndSpace can do — entries whose CLI
/// isn't on PATH come back as `disabled: true` and render greyed out with
/// a "Not installed" hint, instead of disappearing silently.
export function actionsForFile(editors: AvailableEditors): FileAction[] {
  return [
    {
      type: "open",
      tool: "cursor",
      label: "Open in Cursor",
      disabled: !editors.cursor,
    },
    {
      type: "open",
      tool: "code",
      label: "Open in VS Code",
      disabled: !editors.code,
    },
    {
      type: "nvim-split",
      label: "Open in Neovim split",
      disabled: !editors.nvim,
    },
    { type: "copy", label: "Copy path" },
    { type: "reveal", label: "Reveal in Finder" },
  ];
}

/// Default action used by Cmd+Enter. The user's explicit preference wins when
/// the required CLI is available; otherwise Auto falls through Cursor > Code >
/// Neovim > Copy so the command always does something safe.
/// Returns the action that should run immediately, never null.
export function defaultActionFor(
  editors: AvailableEditors,
  preference: DefaultFileAction = "auto"
): FileAction {
  if (preference === "cursor" && editors.cursor) {
    return { type: "open", tool: "cursor", label: "Open in Cursor" };
  }
  if (preference === "code" && editors.code) {
    return { type: "open", tool: "code", label: "Open in VS Code" };
  }
  if (preference === "nvim-split" && editors.nvim) {
    return { type: "nvim-split", label: "Open in Neovim split" };
  }
  if (preference === "copy") {
    return { type: "copy", label: "Copy path" };
  }
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
