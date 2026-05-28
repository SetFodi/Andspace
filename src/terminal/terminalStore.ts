import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import type {
  CommandHistoryEntry,
  PaneId,
  PaneMeta,
  SplitDirection,
  SplitNode,
  Tab,
  TabId,
} from "./types";
import type { ShellOscEvent } from "./shellIntegration";
import { loadRulesForCwd, type ResolvedRules } from "./rules";

const MAX_COMMAND_HISTORY = 50;

interface State {
  tabs: Tab[];
  activeTabId: TabId;
  activePaneByTab: Record<TabId, PaneId>;
  paneMeta: Record<PaneId, PaneMeta>;
  commandHistoryByPane: Record<PaneId, CommandHistoryEntry[]>;
  resolvedRulesByPane: Record<PaneId, ResolvedRules>;

  newTab: () => Promise<void>;
  closeTab: (id: TabId) => Promise<void>;
  splitActive: (direction: SplitDirection) => Promise<void>;
  closePane: (paneId: PaneId) => Promise<void>;
  closeActive: () => Promise<void>;
  setActivePane: (tabId: TabId, paneId: PaneId) => void;
  setActiveTab: (id: TabId) => void;
  nextTab: () => void;
  prevTab: () => void;
  switchToIndex: (idx: number) => void;
  updatePaneMeta: (paneId: PaneId, patch: Partial<PaneMeta>) => void;
  loadRulesForPane: (paneId: PaneId, cwd: string) => Promise<void>;
  handleShellOsc: (
    paneId: PaneId,
    event: ShellOscEvent,
    outputBoundary: number
  ) => void;
  clearPaneShellState: (paneId: PaneId) => void;
}

function uid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

async function createPty(): Promise<string> {
  return invoke<string>("create_pty", { cols: 80, rows: 24 });
}

async function killPty(paneId: string) {
  try {
    await invoke("kill_pty", { paneId });
  } catch {
    // pane may already be gone (e.g., shell exited); ignore
  }
}

function findAndReplace(
  node: SplitNode,
  target: PaneId,
  replacement: SplitNode
): SplitNode {
  if (node.kind === "pane") {
    return node.paneId === target ? replacement : node;
  }
  return {
    ...node,
    a: findAndReplace(node.a, target, replacement),
    b: findAndReplace(node.b, target, replacement),
  };
}

function removePane(node: SplitNode, target: PaneId): SplitNode | null {
  if (node.kind === "pane") {
    return node.paneId === target ? null : node;
  }
  const a = removePane(node.a, target);
  const b = removePane(node.b, target);
  if (a && b) return { ...node, a, b };
  return a || b;
}

function collectPanes(node: SplitNode): PaneId[] {
  if (node.kind === "pane") return [node.paneId];
  return [...collectPanes(node.a), ...collectPanes(node.b)];
}

function initPaneShellState(
  paneMeta: Record<PaneId, PaneMeta>,
  commandHistoryByPane: Record<PaneId, CommandHistoryEntry[]>,
  resolvedRulesByPane: Record<PaneId, ResolvedRules>,
  paneId: PaneId
) {
  return {
    paneMeta: { ...paneMeta, [paneId]: {} },
    commandHistoryByPane: { ...commandHistoryByPane, [paneId]: [] },
    resolvedRulesByPane,
  };
}

function dropPaneShellState(
  paneMeta: Record<PaneId, PaneMeta>,
  commandHistoryByPane: Record<PaneId, CommandHistoryEntry[]>,
  resolvedRulesByPane: Record<PaneId, ResolvedRules>,
  paneId: PaneId
) {
  const { [paneId]: _m, ...restMeta } = paneMeta;
  const { [paneId]: _h, ...restHistory } = commandHistoryByPane;
  const { [paneId]: _r, ...restRules } = resolvedRulesByPane;
  return {
    paneMeta: restMeta,
    commandHistoryByPane: restHistory,
    resolvedRulesByPane: restRules,
  };
}

export const useStore = create<State>((set, get) => ({
  tabs: [],
  activeTabId: "",
  activePaneByTab: {},
  paneMeta: {},
  commandHistoryByPane: {},
  resolvedRulesByPane: {},

  updatePaneMeta: (paneId, patch) =>
    set((s) => ({
      paneMeta: {
        ...s.paneMeta,
        [paneId]: { ...s.paneMeta[paneId], ...patch },
      },
    })),

  loadRulesForPane: async (paneId, cwd) => {
    try {
      const resolved = await loadRulesForCwd(cwd);
      set((s) => ({
        resolvedRulesByPane: {
          ...s.resolvedRulesByPane,
          [paneId]: resolved,
        },
      }));
    } catch (e) {
      console.warn("Failed to load AndSpace rules", e);
    }
  },

  handleShellOsc: (paneId, event, outputBoundary) => {
    const meta = get().paneMeta[paneId] ?? {};
    if (event.kind === "cwd" && event.cwd) {
      get().updatePaneMeta(paneId, { cwd: event.cwd });
      return;
    }
    if (event.kind === "start") {
      get().updatePaneMeta(paneId, {
        commandRunning: true,
        lastCommandStartedAt: event.timestamp ?? Date.now(),
        outputBoundary,
      });
      return;
    }
    if (event.kind === "cmd" && event.command) {
      get().updatePaneMeta(paneId, { lastCommand: event.command });
      return;
    }
    if (event.kind === "end") {
      const endedAt = event.timestamp ?? Date.now();
      const exitCode = event.exitCode ?? 0;
      const entry: CommandHistoryEntry = {
        command: meta.lastCommand ?? "",
        exitCode,
        startedAt: meta.lastCommandStartedAt ?? endedAt,
        endedAt,
        outputBoundary: meta.outputBoundary ?? outputBoundary,
      };
      set((s) => {
        const prev = s.commandHistoryByPane[paneId] ?? [];
        const next = [...prev, entry].slice(-MAX_COMMAND_HISTORY);
        return {
          commandHistoryByPane: {
            ...s.commandHistoryByPane,
            [paneId]: next,
          },
          paneMeta: {
            ...s.paneMeta,
            [paneId]: {
              ...meta,
              commandRunning: false,
              lastExitCode: exitCode,
              lastCommandEndedAt: endedAt,
            },
          },
        };
      });
    }
  },

  clearPaneShellState: (paneId) =>
    set((s) =>
      dropPaneShellState(
        s.paneMeta,
        s.commandHistoryByPane,
        s.resolvedRulesByPane,
        paneId
      )
    ),

  newTab: async () => {
    const paneId = await createPty();
    const tab: Tab = {
      id: uid(),
      title: "shell",
      root: { kind: "pane", paneId },
    };
    set((s) => ({
      ...initPaneShellState(
        s.paneMeta,
        s.commandHistoryByPane,
        s.resolvedRulesByPane,
        paneId
      ),
      tabs: [...s.tabs, tab],
      activeTabId: tab.id,
      activePaneByTab: { ...s.activePaneByTab, [tab.id]: paneId },
    }));
  },

  closeTab: async (id) => {
    const tab = get().tabs.find((t) => t.id === id);
    if (!tab) return;
    for (const p of collectPanes(tab.root)) {
      await killPty(p);
    }
    set((s) => {
      const remaining = s.tabs.filter((t) => t.id !== id);
      const nextActive =
        s.activeTabId === id
          ? (remaining[remaining.length - 1]?.id ?? "")
          : s.activeTabId;
      const { [id]: _removed, ...rest } = s.activePaneByTab;
      let paneMeta = s.paneMeta;
      let commandHistoryByPane = s.commandHistoryByPane;
      let resolvedRulesByPane = s.resolvedRulesByPane;
      for (const p of collectPanes(tab.root)) {
        ({ paneMeta, commandHistoryByPane, resolvedRulesByPane } =
          dropPaneShellState(
            paneMeta,
            commandHistoryByPane,
            resolvedRulesByPane,
            p
          ));
      }
      return {
        tabs: remaining,
        activeTabId: nextActive,
        activePaneByTab: rest,
        paneMeta,
        commandHistoryByPane,
        resolvedRulesByPane,
      };
    });
  },

  splitActive: async (direction) => {
    const { activeTabId, activePaneByTab, tabs } = get();
    const tab = tabs.find((t) => t.id === activeTabId);
    const activePane = activePaneByTab[activeTabId];
    if (!tab || !activePane) return;
    const newPaneId = await createPty();
    const newRoot = findAndReplace(tab.root, activePane, {
      kind: "split",
      direction,
      a: { kind: "pane", paneId: activePane },
      b: { kind: "pane", paneId: newPaneId },
    });
    set((s) => ({
      ...initPaneShellState(
        s.paneMeta,
        s.commandHistoryByPane,
        s.resolvedRulesByPane,
        newPaneId
      ),
      tabs: s.tabs.map((t) => (t.id === tab.id ? { ...t, root: newRoot } : t)),
      activePaneByTab: { ...s.activePaneByTab, [tab.id]: newPaneId },
    }));
  },

  closePane: async (paneId) => {
    await killPty(paneId);
    const { tabs, activeTabId } = get();
    const tab = tabs.find((t) => t.id === activeTabId);
    if (!tab) return;
    const newRoot = removePane(tab.root, paneId);
    if (!newRoot) {
      await get().closeTab(activeTabId);
      return;
    }
    const remainingPanes = collectPanes(newRoot);
    set((s) => ({
      ...dropPaneShellState(
        s.paneMeta,
        s.commandHistoryByPane,
        s.resolvedRulesByPane,
        paneId
      ),
      tabs: s.tabs.map((t) => (t.id === tab.id ? { ...t, root: newRoot } : t)),
      activePaneByTab: {
        ...s.activePaneByTab,
        [tab.id]: remainingPanes[0],
      },
    }));
  },

  closeActive: async () => {
    const { tabs, activeTabId, activePaneByTab } = get();
    const tab = tabs.find((t) => t.id === activeTabId);
    if (!tab) return;
    const panes = collectPanes(tab.root);
    if (panes.length > 1) {
      const activePane = activePaneByTab[activeTabId];
      if (activePane) await get().closePane(activePane);
    } else {
      await get().closeTab(activeTabId);
    }
  },

  setActivePane: (tabId, paneId) =>
    set((s) => ({
      activePaneByTab: { ...s.activePaneByTab, [tabId]: paneId },
    })),

  setActiveTab: (id) => set({ activeTabId: id }),

  nextTab: () => {
    const { tabs, activeTabId } = get();
    if (tabs.length < 2) return;
    const idx = tabs.findIndex((t) => t.id === activeTabId);
    const next = tabs[(idx + 1) % tabs.length];
    set({ activeTabId: next.id });
  },

  prevTab: () => {
    const { tabs, activeTabId } = get();
    if (tabs.length < 2) return;
    const idx = tabs.findIndex((t) => t.id === activeTabId);
    const prev = tabs[(idx - 1 + tabs.length) % tabs.length];
    set({ activeTabId: prev.id });
  },

  switchToIndex: (idx) => {
    const { tabs } = get();
    if (idx < 0 || idx >= tabs.length) return;
    set({ activeTabId: tabs[idx].id });
  },
}));
