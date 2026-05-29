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
import {
  evaluateCommandGuard,
  reportCommandGuardUiRequest,
  respondCommandGuard,
  type CommandGuardEvaluation,
  type GuardConfirmationRequest,
} from "./commandGuard";
import {
  clearOutputCapture,
  finishOutputCapture,
  startOutputCapture,
  type HandoffCommandRecord,
} from "./aiHandoff";
import { useServerStore } from "./serverStore";
import {
  findNearestPaneInDirection,
  type PaneFocusDirection,
} from "./paneNavigation";
import {
  collectPersistedPaneIds,
  remapPersistedSplitNode,
  type WorkspaceSnapshot,
} from "./workspaceModel";
import { usePreferencesStore } from "./preferencesStore";

const MAX_COMMAND_HISTORY = 50;
const MAX_GUARD_HISTORY = 50;
const MAX_HANDOFF_HISTORY = 12;

interface State {
  tabs: Tab[];
  activeTabId: TabId;
  activePaneByTab: Record<TabId, PaneId>;
  paneMeta: Record<PaneId, PaneMeta>;
  commandHistoryByPane: Record<PaneId, CommandHistoryEntry[]>;
  handoffHistoryByPane: Record<PaneId, HandoffCommandRecord[]>;
  selectedTextByPane: Record<PaneId, string>;
  resolvedRulesByPane: Record<PaneId, ResolvedRules>;
  guardEvaluationsByPane: Record<PaneId, CommandGuardEvaluation[]>;
  pendingGuardConfirmation: GuardConfirmationRequest | null;

  newTab: () => Promise<PaneId | null>;
  restoreWorkspace: (snapshot: WorkspaceSnapshot) => Promise<boolean>;
  closeTab: (id: TabId) => Promise<void>;
  splitActive: (direction: SplitDirection) => Promise<PaneId | null>;
  closePane: (paneId: PaneId) => Promise<void>;
  closeActive: () => Promise<void>;
  focusPaneInDirection: (direction: PaneFocusDirection) => PaneId | null;
  setActivePane: (tabId: TabId, paneId: PaneId) => void;
  setActiveTab: (id: TabId) => void;
  nextTab: () => void;
  prevTab: () => void;
  switchToIndex: (idx: number) => void;
  updatePaneMeta: (paneId: PaneId, patch: Partial<PaneMeta>) => void;
  setPaneSelectedText: (paneId: PaneId, text: string) => void;
  writeToPane: (paneId: PaneId, data: string) => Promise<void>;
  loadRulesForPane: (paneId: PaneId, cwd: string) => Promise<void>;
  evaluateGuardForPane: (paneId: PaneId, command: string) => Promise<void>;
  respondToGuardConfirmation: (action: "run" | "cancel") => Promise<void>;
  handleShellOsc: (
    paneId: PaneId,
    event: ShellOscEvent,
    outputBoundary: number
  ) => void;
  clearPaneShellState: (paneId: PaneId) => void;
}

interface CreatedPty {
  paneId: string;
  cwd: string;
}

function uid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

async function createPty(cwd?: string): Promise<CreatedPty> {
  const commandGuardEnabled =
    usePreferencesStore.getState().preferences.safety.commandGuardEnabled;
  return invoke<CreatedPty>("create_pty", {
    cols: 80,
    rows: 24,
    cwd,
    commandGuardEnabled,
  });
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
  handoffHistoryByPane: Record<PaneId, HandoffCommandRecord[]>,
  selectedTextByPane: Record<PaneId, string>,
  resolvedRulesByPane: Record<PaneId, ResolvedRules>,
  guardEvaluationsByPane: Record<PaneId, CommandGuardEvaluation[]>,
  paneId: PaneId
) {
  return {
    paneMeta: { ...paneMeta, [paneId]: {} },
    commandHistoryByPane: { ...commandHistoryByPane, [paneId]: [] },
    handoffHistoryByPane: { ...handoffHistoryByPane, [paneId]: [] },
    selectedTextByPane: { ...selectedTextByPane, [paneId]: "" },
    resolvedRulesByPane,
    guardEvaluationsByPane: { ...guardEvaluationsByPane, [paneId]: [] },
  };
}

function dropPaneShellState(
  paneMeta: Record<PaneId, PaneMeta>,
  commandHistoryByPane: Record<PaneId, CommandHistoryEntry[]>,
  handoffHistoryByPane: Record<PaneId, HandoffCommandRecord[]>,
  selectedTextByPane: Record<PaneId, string>,
  resolvedRulesByPane: Record<PaneId, ResolvedRules>,
  guardEvaluationsByPane: Record<PaneId, CommandGuardEvaluation[]>,
  paneId: PaneId
) {
  const { [paneId]: _m, ...restMeta } = paneMeta;
  const { [paneId]: _h, ...restHistory } = commandHistoryByPane;
  const { [paneId]: _hh, ...restHandoffHistory } = handoffHistoryByPane;
  const { [paneId]: _st, ...restSelectedText } = selectedTextByPane;
  const { [paneId]: _r, ...restRules } = resolvedRulesByPane;
  const { [paneId]: _g, ...restGuardHistory } = guardEvaluationsByPane;
  clearOutputCapture(paneId);
  // Drop detected servers for this pane so the sidebar stays accurate
  // when panes are closed or recreated.
  useServerStore.getState().clearForPane(paneId);
  return {
    paneMeta: restMeta,
    commandHistoryByPane: restHistory,
    handoffHistoryByPane: restHandoffHistory,
    selectedTextByPane: restSelectedText,
    resolvedRulesByPane: restRules,
    guardEvaluationsByPane: restGuardHistory,
  };
}

export const useStore = create<State>((set, get) => ({
  tabs: [],
  activeTabId: "",
  activePaneByTab: {},
  paneMeta: {},
  commandHistoryByPane: {},
  handoffHistoryByPane: {},
  selectedTextByPane: {},
  resolvedRulesByPane: {},
  guardEvaluationsByPane: {},
  pendingGuardConfirmation: null,

  updatePaneMeta: (paneId, patch) =>
    set((s) => ({
      paneMeta: {
        ...s.paneMeta,
        [paneId]: { ...s.paneMeta[paneId], ...patch },
      },
    })),

  setPaneSelectedText: (paneId, text) =>
    set((s) => ({
      selectedTextByPane: {
        ...s.selectedTextByPane,
        [paneId]: text,
      },
    })),

  writeToPane: async (paneId, data) => {
    await invoke("write_to_pty", { paneId, data });
  },

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

  evaluateGuardForPane: async (paneId, command) => {
    const cwd = get().paneMeta[paneId]?.cwd;
    if (!cwd) return;

    try {
      let rules = get().resolvedRulesByPane[paneId];
      if (!rules || rules.cwd !== cwd) {
        rules = await loadRulesForCwd(cwd);
        set((s) => ({
          resolvedRulesByPane: {
            ...s.resolvedRulesByPane,
            [paneId]: rules,
          },
        }));
      }

      const result = await evaluateCommandGuard(paneId, command, cwd, rules);
      set((s) => {
        const prev = s.guardEvaluationsByPane[paneId] ?? [];
        const next = [...prev, result].slice(-MAX_GUARD_HISTORY);
        return {
          guardEvaluationsByPane: {
            ...s.guardEvaluationsByPane,
            [paneId]: next,
          },
        };
      });
    } catch (e) {
      console.warn("Failed to evaluate Command Guard", e);
    }
  },

  respondToGuardConfirmation: async (action) => {
    const request = get().pendingGuardConfirmation;
    if (!request) return;
    set({ pendingGuardConfirmation: null });
    try {
      await respondCommandGuard(request, action);
    } catch (e) {
      console.warn("Failed to respond to Command Guard", e);
    }
  },

  handleShellOsc: (paneId, event, outputBoundary) => {
    const meta = get().paneMeta[paneId] ?? {};
    if (event.kind === "cwd" && event.cwd) {
      get().updatePaneMeta(paneId, { cwd: event.cwd });
      return;
    }
    if (event.kind === "start") {
      startOutputCapture(paneId);
      get().updatePaneMeta(paneId, {
        commandRunning: true,
        lastCommandStartedAt: event.timestamp ?? Date.now(),
        outputBoundary,
      });
      return;
    }
    if (event.kind === "cmd" && event.command) {
      get().updatePaneMeta(paneId, { lastCommand: event.command });
      if (usePreferencesStore.getState().preferences.safety.commandGuardEnabled) {
        void get().evaluateGuardForPane(paneId, event.command);
      }
      return;
    }
    if (
      event.kind === "guard-request" &&
      event.requestId &&
      event.command &&
      event.cwd &&
      event.decision &&
      event.severity &&
      event.matchedRule &&
      event.matchedSource &&
      event.matchedPatternType
    ) {
      const request: GuardConfirmationRequest = {
        requestId: event.requestId,
        paneId,
        command: event.command,
        cwd: event.cwd,
        decision: event.decision,
        severity: event.severity,
        matchedRule: event.matchedRule,
        matchedSource: event.matchedSource,
        matchedPatternType: event.matchedPatternType,
        requestedAt: Date.now(),
      };
      set({ pendingGuardConfirmation: request });
      void reportCommandGuardUiRequest(request);
      return;
    }
    if (event.kind === "end") {
      const endedAt = event.timestamp ?? Date.now();
      const exitCode = event.exitCode ?? 0;
      const captured = finishOutputCapture(paneId);
      const entry: CommandHistoryEntry = {
        command: meta.lastCommand ?? "",
        exitCode,
        startedAt: meta.lastCommandStartedAt ?? endedAt,
        endedAt,
        outputBoundary: meta.outputBoundary ?? outputBoundary,
        outputLines: captured.outputLines,
        outputLineCount: captured.outputLineCount,
        outputTruncated: captured.outputTruncated,
      };
      const handoffRecord: HandoffCommandRecord = {
        command: entry.command,
        cwd: meta.cwd ?? "",
        exitCode,
        startedAt: entry.startedAt,
        endedAt,
        outputLines: captured.outputLines,
        outputLineCount: captured.outputLineCount,
        outputTruncated: captured.outputTruncated,
      };
      set((s) => {
        const prev = s.commandHistoryByPane[paneId] ?? [];
        const next = [...prev, entry].slice(-MAX_COMMAND_HISTORY);
        const prevHandoff = s.handoffHistoryByPane[paneId] ?? [];
        const nextHandoff = [...prevHandoff, handoffRecord].slice(
          -MAX_HANDOFF_HISTORY
        );
        return {
          commandHistoryByPane: {
            ...s.commandHistoryByPane,
            [paneId]: next,
          },
          handoffHistoryByPane: {
            ...s.handoffHistoryByPane,
            [paneId]: nextHandoff,
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
      // Server detection is intentionally passive: if the foreground command
      // that printed the URL exits, clear that pane's detected URLs instead
      // of pretending we know the server is still alive.
      useServerStore.getState().clearForPane(paneId);
    }
  },

  clearPaneShellState: (paneId) =>
    set((s) =>
      dropPaneShellState(
        s.paneMeta,
        s.commandHistoryByPane,
        s.handoffHistoryByPane,
        s.selectedTextByPane,
        s.resolvedRulesByPane,
        s.guardEvaluationsByPane,
        paneId
      )
    ),

  newTab: async () => {
    const created = await createPty();
    const paneId = created.paneId;
    const tab: Tab = {
      id: uid(),
      title: "shell",
      root: { kind: "pane", paneId },
    };
    set((s) => ({
      ...initPaneShellState(
        s.paneMeta,
        s.commandHistoryByPane,
        s.handoffHistoryByPane,
        s.selectedTextByPane,
        s.resolvedRulesByPane,
        s.guardEvaluationsByPane,
        paneId
      ),
      tabs: [...s.tabs, tab],
      activeTabId: tab.id,
      activePaneByTab: { ...s.activePaneByTab, [tab.id]: paneId },
    }));
    return paneId;
  },

  restoreWorkspace: async (snapshot) => {
    const oldPaneIds = get().tabs.flatMap((tab) => collectPanes(tab.root));
    const oldToNew: Record<PaneId, PaneId> = {};
    const newPaneMeta: Record<PaneId, PaneMeta> = {};
    const newCommandHistory: Record<PaneId, CommandHistoryEntry[]> = {};
    const newHandoffHistory: Record<PaneId, HandoffCommandRecord[]> = {};
    const newSelectedText: Record<PaneId, string> = {};
    const newGuardHistory: Record<PaneId, CommandGuardEvaluation[]> = {};
    const createdPaneIds: PaneId[] = [];

    try {
      for (const oldPaneId of collectPersistedPaneIds(snapshot)) {
        const created = await createPty(snapshot.panes[oldPaneId]?.cwd);
        oldToNew[oldPaneId] = created.paneId;
        createdPaneIds.push(created.paneId);
        newPaneMeta[created.paneId] = created.cwd ? { cwd: created.cwd } : {};
        newCommandHistory[created.paneId] = [];
        newHandoffHistory[created.paneId] = [];
        newSelectedText[created.paneId] = "";
        newGuardHistory[created.paneId] = [];
      }

      const restoredTabs: Tab[] = [];
      const activePaneByTab: Record<TabId, PaneId> = {};
      for (const savedTab of snapshot.tabs) {
        const root = remapPersistedSplitNode(savedTab.root, oldToNew);
        if (!root) continue;
        restoredTabs.push({
          id: savedTab.id,
          title: savedTab.title || "shell",
          root,
        });
        const savedActive =
          snapshot.activePaneByTab[savedTab.id] ??
          (snapshot.activeTabId === savedTab.id ? snapshot.activePaneId : null);
        const mappedActive = savedActive ? oldToNew[savedActive] : null;
        activePaneByTab[savedTab.id] = mappedActive ?? collectPanes(root)[0];
      }

      if (restoredTabs.length === 0) {
        throw new Error("workspace contained no restorable tabs");
      }

      for (const oldPaneId of oldPaneIds) {
        await killPty(oldPaneId);
      }
      for (const oldPaneId of oldPaneIds) {
        clearOutputCapture(oldPaneId);
        useServerStore.getState().clearForPane(oldPaneId);
      }

      const activeTabId =
        snapshot.activeTabId &&
        restoredTabs.some((tab) => tab.id === snapshot.activeTabId)
          ? snapshot.activeTabId
          : restoredTabs[0].id;

      set({
        tabs: restoredTabs,
        activeTabId,
        activePaneByTab,
        paneMeta: newPaneMeta,
        commandHistoryByPane: newCommandHistory,
        handoffHistoryByPane: newHandoffHistory,
        selectedTextByPane: newSelectedText,
        resolvedRulesByPane: {},
        guardEvaluationsByPane: newGuardHistory,
        pendingGuardConfirmation: null,
      });
      return true;
    } catch (e) {
      console.warn("Failed to restore workspace", e);
      for (const paneId of createdPaneIds) {
        await killPty(paneId);
      }
      return false;
    }
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
      let handoffHistoryByPane = s.handoffHistoryByPane;
      let selectedTextByPane = s.selectedTextByPane;
      let resolvedRulesByPane = s.resolvedRulesByPane;
      let guardEvaluationsByPane = s.guardEvaluationsByPane;
      for (const p of collectPanes(tab.root)) {
        ({
          paneMeta,
          commandHistoryByPane,
          handoffHistoryByPane,
          selectedTextByPane,
          resolvedRulesByPane,
          guardEvaluationsByPane,
        } =
          dropPaneShellState(
            paneMeta,
            commandHistoryByPane,
            handoffHistoryByPane,
            selectedTextByPane,
            resolvedRulesByPane,
            guardEvaluationsByPane,
            p
          ));
      }
      return {
        tabs: remaining,
        activeTabId: nextActive,
        activePaneByTab: rest,
        paneMeta,
        commandHistoryByPane,
        handoffHistoryByPane,
        selectedTextByPane,
        resolvedRulesByPane,
        guardEvaluationsByPane,
      };
    });
  },

  splitActive: async (direction) => {
    const { activeTabId, activePaneByTab, tabs } = get();
    const tab = tabs.find((t) => t.id === activeTabId);
    const activePane = activePaneByTab[activeTabId];
    if (!tab || !activePane) return null;
    const created = await createPty();
    const newPaneId = created.paneId;
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
        s.handoffHistoryByPane,
        s.selectedTextByPane,
        s.resolvedRulesByPane,
        s.guardEvaluationsByPane,
        newPaneId
      ),
      tabs: s.tabs.map((t) => (t.id === tab.id ? { ...t, root: newRoot } : t)),
      activePaneByTab: { ...s.activePaneByTab, [tab.id]: newPaneId },
    }));
    return newPaneId;
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
        s.handoffHistoryByPane,
        s.selectedTextByPane,
        s.resolvedRulesByPane,
        s.guardEvaluationsByPane,
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

  focusPaneInDirection: (direction) => {
    const { tabs, activeTabId, activePaneByTab } = get();
    const tab = tabs.find((t) => t.id === activeTabId);
    const activePane = activePaneByTab[activeTabId];
    if (!tab || !activePane) return null;

    const nextPane = findNearestPaneInDirection(
      tab.root,
      activePane,
      direction
    );
    if (!nextPane) return null;

    set((s) => ({
      activePaneByTab: { ...s.activePaneByTab, [activeTabId]: nextPane },
    }));
    return nextPane;
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
