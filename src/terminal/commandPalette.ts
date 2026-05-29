import { invoke } from "@tauri-apps/api/core";

export type CommandPaletteActionId =
  | "terminal.newTab"
  | "terminal.splitRight"
  | "terminal.splitDown"
  | "terminal.closePane"
  | "sidebar.toggle"
  | "sidebar.focusFiles"
  | "sidebar.focusScripts"
  | "sidebar.runScript"
  | "project.createAndspace"
  | "project.goToFile"
  | "handoff.sendContext"
  | "handoff.copyLastPrompt"
  | "servers.openPreview"
  | "servers.copyUrl"
  | "servers.focus"
  | "git.focus"
  | "git.refresh"
  | "git.openDiff"
  | "git.copyDiff"
  | "git.openChangedFile"
  | "workspace.restore"
  | "workspace.reset"
  | "preferences.open"
  | "preferences.colorScheme"
  | "help.showKeybinds";

export interface CommandPaletteAction {
  id: CommandPaletteActionId;
  title: string;
  section:
    | "Terminal"
    | "Project"
    | "Servers"
    | "Git"
    | "Workspace"
    | "Preferences"
    | "AI / Handoff"
    | "Help";
  keywords: string[];
}

export const COMMAND_PALETTE_ACTIONS: CommandPaletteAction[] = [
  {
    id: "terminal.newTab",
    title: "New Tab",
    section: "Terminal",
    keywords: ["tab", "terminal", "new"],
  },
  {
    id: "terminal.splitRight",
    title: "Split Right",
    section: "Terminal",
    keywords: ["split", "right", "pane", "cmd", "o"],
  },
  {
    id: "terminal.splitDown",
    title: "Split Down",
    section: "Terminal",
    keywords: ["split", "down", "pane", "cmd", "l"],
  },
  {
    id: "terminal.closePane",
    title: "Close Pane",
    section: "Terminal",
    keywords: ["close", "pane"],
  },
  {
    id: "sidebar.toggle",
    title: "Toggle Sidebar",
    section: "Project",
    keywords: ["sidebar", "project", "files", "scripts"],
  },
  {
    id: "sidebar.focusFiles",
    title: "Focus Files",
    section: "Project",
    keywords: ["sidebar", "files", "tree"],
  },
  {
    id: "sidebar.focusScripts",
    title: "Focus Scripts",
    section: "Project",
    keywords: ["sidebar", "scripts", "package"],
  },
  {
    id: "sidebar.runScript",
    title: "Run Script",
    section: "Project",
    keywords: ["sidebar", "scripts", "run", "package"],
  },
  {
    id: "project.createAndspace",
    title: "Create ANDSPACE.md",
    section: "Project",
    keywords: ["andspace", "rules", "init", "project"],
  },
  {
    id: "project.goToFile",
    title: "Go to File",
    section: "Project",
    keywords: ["go", "to", "file", "open", "picker", "fuzzy", "search"],
  },
  {
    id: "handoff.sendContext",
    title: "Send Context",
    section: "AI / Handoff",
    keywords: ["ai", "handoff", "context", "prompt"],
  },
  {
    id: "handoff.copyLastPrompt",
    title: "Copy Last Prompt",
    section: "AI / Handoff",
    keywords: ["copy", "prompt", "handoff"],
  },
  {
    id: "servers.openPreview",
    title: "Open Localhost Preview",
    section: "Servers",
    keywords: [
      "server",
      "localhost",
      "preview",
      "open",
      "browser",
      "url",
      "dev",
    ],
  },
  {
    id: "servers.copyUrl",
    title: "Copy Server URL",
    section: "Servers",
    keywords: ["server", "copy", "url", "localhost", "clipboard"],
  },
  {
    id: "servers.focus",
    title: "Focus Servers",
    section: "Servers",
    keywords: ["server", "focus", "sidebar", "servers"],
  },
  {
    id: "git.focus",
    title: "Focus Git Changes",
    section: "Git",
    keywords: ["git", "changes", "status", "sidebar", "focus"],
  },
  {
    id: "git.refresh",
    title: "Refresh Git Changes",
    section: "Git",
    keywords: ["git", "changes", "status", "refresh"],
  },
  {
    id: "git.openDiff",
    title: "Open Git Diff",
    section: "Git",
    keywords: ["git", "diff", "preview", "changes", "modified"],
  },
  {
    id: "git.copyDiff",
    title: "Copy Git Diff",
    section: "Git",
    keywords: ["git", "diff", "copy", "patch", "clipboard"],
  },
  {
    id: "git.openChangedFile",
    title: "Open Changed File",
    section: "Git",
    keywords: ["git", "changes", "file", "open", "modified"],
  },
  {
    id: "workspace.restore",
    title: "Restore Last Workspace",
    section: "Workspace",
    keywords: ["workspace", "restore", "session", "tabs", "panes"],
  },
  {
    id: "workspace.reset",
    title: "Reset Saved Workspace",
    section: "Workspace",
    keywords: ["workspace", "reset", "clear", "session", "restore"],
  },
  {
    id: "preferences.open",
    title: "Open Preferences",
    section: "Preferences",
    keywords: ["preferences", "settings", "first", "run", "onboarding"],
  },
  {
    id: "preferences.colorScheme",
    title: "Color Scheme",
    section: "Preferences",
    keywords: ["theme", "color", "scheme", "appearance", "palette", "cmd", "p"],
  },
  {
    id: "help.showKeybinds",
    title: "Keyboard Shortcuts",
    section: "Help",
    keywords: ["help", "keybinds", "shortcuts", "cheatsheet", "hotkeys"],
  },
];

export function filterCommandPaletteActions(query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return COMMAND_PALETTE_ACTIONS;

  return COMMAND_PALETTE_ACTIONS.filter((action) => {
    const haystack = [
      action.title,
      action.section,
      action.id,
      ...action.keywords,
    ]
      .join(" ")
      .toLowerCase();
    return normalized
      .split(/\s+/)
      .every((part) => haystack.includes(part));
  });
}

export function reportCommandPaletteOpen(): Promise<void> {
  return invoke("report_command_palette_event", { action: null });
}

export function reportCommandPaletteRun(
  action: CommandPaletteActionId
): Promise<void> {
  return invoke("report_command_palette_event", { action });
}
