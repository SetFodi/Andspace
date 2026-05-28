import type { PaneId, PaneMeta, SplitDirection, SplitNode, Tab } from "./types";

export const WORKSPACE_VERSION = 1;
export const FIXED_SIDEBAR_WIDTH = 256;

export type WorkspaceSidebarSection = "files" | "scripts" | "servers" | "git";

export type PersistedSplitNode =
  | { kind: "pane"; paneId: PaneId }
  | {
      kind: "split";
      direction: SplitDirection;
      a: PersistedSplitNode;
      b: PersistedSplitNode;
    };

export interface PersistedTab {
  id: string;
  title: string;
  root: PersistedSplitNode;
}

export interface PersistedPane {
  cwd?: string;
}

export interface PersistedSidebar {
  open: boolean;
  focusedSection: WorkspaceSidebarSection;
  width: number;
}

export interface PersistedWindow {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface WorkspaceMonitorArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface WorkspaceSnapshot {
  version: number;
  savedAt: number;
  activeTabId: string | null;
  activePaneId: string | null;
  activePaneByTab: Record<string, PaneId>;
  tabs: PersistedTab[];
  panes: Record<PaneId, PersistedPane>;
  sidebar: PersistedSidebar;
  projectRoot?: string;
  window?: PersistedWindow;
}

export interface WorkspaceBuildInput {
  tabs: Tab[];
  activeTabId: string;
  activePaneByTab: Record<string, PaneId>;
  paneMeta: Record<PaneId, PaneMeta>;
  sidebarOpen: boolean;
  sidebarSection: WorkspaceSidebarSection;
  projectRoot?: string;
  window?: PersistedWindow;
}

export function buildWorkspaceSnapshot(
  input: WorkspaceBuildInput
): WorkspaceSnapshot {
  const panes: Record<PaneId, PersistedPane> = {};
  for (const tab of input.tabs) {
    for (const paneId of collectPaneIds(tab.root)) {
      const cwd = input.paneMeta[paneId]?.cwd;
      panes[paneId] = cwd ? { cwd } : {};
    }
  }

  return {
    version: WORKSPACE_VERSION,
    savedAt: Date.now(),
    activeTabId: input.activeTabId || null,
    activePaneId: input.activePaneByTab[input.activeTabId] ?? null,
    activePaneByTab: pickActivePaneByTab(input.tabs, input.activePaneByTab),
    tabs: input.tabs.map((tab) => ({
      id: tab.id,
      title: tab.title,
      root: toPersistedSplitNode(tab.root),
    })),
    panes,
    sidebar: {
      open: input.sidebarOpen,
      focusedSection: normalizeSidebarSection(input.sidebarSection),
      width: FIXED_SIDEBAR_WIDTH,
    },
    ...(input.projectRoot ? { projectRoot: input.projectRoot } : {}),
    ...(input.window ? { window: input.window } : {}),
  };
}

export function normalizeWorkspaceSnapshot(
  raw: unknown
): WorkspaceSnapshot | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Partial<WorkspaceSnapshot>;
  const tabs = Array.isArray(value.tabs)
    ? value.tabs
        .map(normalizeTab)
        .filter((tab): tab is PersistedTab => tab !== null)
    : [];
  if (tabs.length === 0) return null;

  const panes =
    value.panes && typeof value.panes === "object" && !Array.isArray(value.panes)
      ? normalizePanes(value.panes as Record<string, unknown>)
      : {};
  const activePaneByTab =
    value.activePaneByTab &&
    typeof value.activePaneByTab === "object" &&
    !Array.isArray(value.activePaneByTab)
      ? normalizeActivePaneByTab(value.activePaneByTab as Record<string, unknown>)
      : {};
  const activeTabId =
    typeof value.activeTabId === "string" &&
    tabs.some((tab) => tab.id === value.activeTabId)
      ? value.activeTabId
      : tabs[0].id;

  return {
    version: typeof value.version === "number" ? value.version : WORKSPACE_VERSION,
    savedAt: typeof value.savedAt === "number" ? value.savedAt : 0,
    activeTabId,
    activePaneId:
      typeof value.activePaneId === "string" ? value.activePaneId : null,
    activePaneByTab,
    tabs,
    panes,
    sidebar: normalizeSidebar(value.sidebar),
    ...(typeof value.projectRoot === "string"
      ? { projectRoot: value.projectRoot }
      : {}),
    ...(isPersistedWindow(value.window) ? { window: value.window } : {}),
  };
}

export function remapPersistedSplitNode(
  node: PersistedSplitNode,
  paneMap: Record<PaneId, PaneId>
): SplitNode | null {
  if (node.kind === "pane") {
    const paneId = paneMap[node.paneId];
    return paneId ? { kind: "pane", paneId } : null;
  }
  const a = remapPersistedSplitNode(node.a, paneMap);
  const b = remapPersistedSplitNode(node.b, paneMap);
  if (a && b) return { kind: "split", direction: node.direction, a, b };
  return a ?? b;
}

export function collectPersistedPaneIds(
  snapshot: WorkspaceSnapshot
): PaneId[] {
  const out: PaneId[] = [];
  const seen = new Set<PaneId>();
  for (const tab of snapshot.tabs) {
    for (const paneId of collectPaneIds(tab.root)) {
      if (!seen.has(paneId)) {
        seen.add(paneId);
        out.push(paneId);
      }
    }
  }
  return out;
}

export function restoreCwdForPane(
  savedCwd: string | undefined,
  home: string,
  exists: (path: string) => boolean
): string {
  if (savedCwd && exists(savedCwd)) return savedCwd;
  return home;
}

export function chooseWindowPlacement(
  saved: PersistedWindow,
  areas: WorkspaceMonitorArea[]
): PersistedWindow {
  const visibleArea = areas.find((area) => hasUsableOverlap(saved, area));
  if (visibleArea) return saved;
  const target = areas[0];
  if (!target) return saved;

  const width = clamp(saved.width, 600, target.width);
  const height = clamp(saved.height, 400, target.height);
  return {
    width,
    height,
    x: clamp(saved.x, target.x, target.x + target.width - width),
    y: clamp(saved.y, target.y, target.y + target.height - height),
  };
}

function toPersistedSplitNode(node: SplitNode): PersistedSplitNode {
  if (node.kind === "pane") return { kind: "pane", paneId: node.paneId };
  return {
    kind: "split",
    direction: node.direction,
    a: toPersistedSplitNode(node.a),
    b: toPersistedSplitNode(node.b),
  };
}

function collectPaneIds(node: SplitNode | PersistedSplitNode): PaneId[] {
  if (node.kind === "pane") return [node.paneId];
  return [...collectPaneIds(node.a), ...collectPaneIds(node.b)];
}

function pickActivePaneByTab(
  tabs: Tab[],
  activePaneByTab: Record<string, PaneId>
): Record<string, PaneId> {
  const result: Record<string, PaneId> = {};
  for (const tab of tabs) {
    const activePane = activePaneByTab[tab.id];
    if (activePane) result[tab.id] = activePane;
  }
  return result;
}

function normalizeTab(value: unknown): PersistedTab | null {
  if (!value || typeof value !== "object") return null;
  const tab = value as Partial<PersistedTab>;
  if (typeof tab.id !== "string" || typeof tab.title !== "string") return null;
  const root = normalizeSplitNode(tab.root);
  if (!root) return null;
  return { id: tab.id, title: tab.title, root };
}

function normalizeSplitNode(value: unknown): PersistedSplitNode | null {
  if (!value || typeof value !== "object") return null;
  const node = value as Partial<PersistedSplitNode>;
  if (node.kind === "pane") {
    const paneId = (node as { paneId?: unknown }).paneId;
    return typeof paneId === "string" ? { kind: "pane", paneId } : null;
  }
  if (node.kind === "split") {
    const direction = (node as { direction?: unknown }).direction;
    if (direction !== "row" && direction !== "column") return null;
    const a = normalizeSplitNode((node as { a?: unknown }).a);
    const b = normalizeSplitNode((node as { b?: unknown }).b);
    if (!a || !b) return null;
    return { kind: "split", direction, a, b };
  }
  return null;
}

function normalizePanes(
  value: Record<string, unknown>
): Record<PaneId, PersistedPane> {
  const panes: Record<PaneId, PersistedPane> = {};
  for (const [paneId, pane] of Object.entries(value)) {
    if (!pane || typeof pane !== "object") {
      panes[paneId] = {};
      continue;
    }
    const cwd = (pane as { cwd?: unknown }).cwd;
    panes[paneId] = typeof cwd === "string" ? { cwd } : {};
  }
  return panes;
}

function normalizeActivePaneByTab(
  value: Record<string, unknown>
): Record<string, PaneId> {
  const active: Record<string, PaneId> = {};
  for (const [tabId, paneId] of Object.entries(value)) {
    if (typeof paneId === "string") active[tabId] = paneId;
  }
  return active;
}

function normalizeSidebar(value: unknown): PersistedSidebar {
  if (!value || typeof value !== "object") {
    return { open: false, focusedSection: "files", width: FIXED_SIDEBAR_WIDTH };
  }
  const sidebar = value as Partial<PersistedSidebar>;
  return {
    open: sidebar.open === true,
    focusedSection: normalizeSidebarSection(sidebar.focusedSection),
    width:
      typeof sidebar.width === "number" && sidebar.width > 0
        ? sidebar.width
        : FIXED_SIDEBAR_WIDTH,
  };
}

function normalizeSidebarSection(
  section: unknown
): WorkspaceSidebarSection {
  return (
    section === "scripts" ||
    section === "servers" ||
    section === "git" ||
    section === "files"
  )
    ? section
    : "files";
}

function isPersistedWindow(value: unknown): value is PersistedWindow {
  if (!value || typeof value !== "object") return false;
  const window = value as Partial<PersistedWindow>;
  return (
    typeof window.x === "number" &&
    typeof window.y === "number" &&
    typeof window.width === "number" &&
    typeof window.height === "number" &&
    window.width >= 600 &&
    window.height >= 400
  );
}

function hasUsableOverlap(
  window: PersistedWindow,
  area: WorkspaceMonitorArea
): boolean {
  const overlapWidth =
    Math.min(window.x + window.width, area.x + area.width) -
    Math.max(window.x, area.x);
  const overlapHeight =
    Math.min(window.y + window.height, area.y + area.height) -
    Math.max(window.y, area.y);
  return overlapWidth >= 120 && overlapHeight >= 120;
}

function clamp(value: number, min: number, max: number): number {
  if (max < min) return min;
  return Math.min(Math.max(value, min), max);
}
