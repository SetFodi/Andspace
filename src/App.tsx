import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import packageJson from "../package.json";
import { useStore } from "./terminal/terminalStore";
import { TabStrip } from "./terminal/TabStrip";
import { SplitTree } from "./terminal/SplitTree";
import { GuardConfirmationOverlay } from "./terminal/GuardConfirmationOverlay";
import { HandoffOverlay } from "./terminal/HandoffOverlay";
import { CommandPaletteOverlay } from "./terminal/CommandPaletteOverlay";
import { FileActionsOverlay } from "./terminal/FileActionsOverlay";
import { GoToFileOverlay } from "./terminal/GoToFileOverlay";
import { KeybindsOverlay } from "./terminal/KeybindsOverlay";
import { GitDiffOverlay } from "./terminal/GitDiffOverlay";
import { PreferencesOverlay } from "./terminal/PreferencesOverlay";
import { ColorSchemeOverlay } from "./terminal/ColorSchemeOverlay";
import {
  UpdateCheckOverlay,
  type UpdateCheckPrompt,
} from "./terminal/UpdateCheckOverlay";
import { LocalPreviewPanel } from "./terminal/LocalPreviewPanel";
import {
  ProjectSidebar,
  scriptCommandForSidebar,
  type ProjectSidebarHandle,
} from "./terminal/ProjectSidebar";
import { initAndspaceRules } from "./terminal/rules";
import {
  buildNvimSplitCommand,
  defaultActionFor,
  detectExternalEditors,
  openInExternalEditor,
  reportFileActionEvent,
  resolveProjectRoot,
  revealInFinder,
  type AvailableEditors,
  type FileAction,
} from "./terminal/fileActions";
import {
  loadProjectTree,
  type ProjectTree,
} from "./terminal/projectSidebarData";
import {
  buildAiHandoffPrompt,
  prepareAiCliHandoff,
  reportAiHandoffEvent,
  type AiCliTarget,
  type HandoffCommandRecord,
  type HandoffPrompt,
} from "./terminal/aiHandoff";
import {
  reportSidebarEvent,
  type PackageScript,
  type PackageScripts,
} from "./terminal/projectSidebarData";
import {
  copyServerUrl,
  openServerUrl,
  reportServer,
  useServerStore,
  type DetectedServer,
} from "./terminal/serverStore";
import {
  buildLocalPreviewTarget,
  buildLocalPreviewTargetFromUrl,
  type LocalPreviewTarget,
} from "./terminal/localPreview";
import {
  absoluteGitPath,
  loadGitDiff,
  loadGitStatus,
  reportGitEvent,
  type GitChangedFile,
  type GitDiffPreview,
  type GitStatus,
} from "./terminal/gitChanges";
import {
  reportCommandPaletteOpen,
  reportCommandPaletteRun,
  type CommandPaletteAction,
  type CommandPaletteActionId,
} from "./terminal/commandPalette";
import {
  buildDiagnosticBlock,
  getPublicDiagnostics,
} from "./terminal/diagnostics";
import { checkForUpdates } from "./terminal/updateCheck";
import type { PaneFocusDirection } from "./terminal/paneNavigation";
import { buildWorkspaceSnapshot } from "./terminal/workspaceModel";
import {
  applyWindowState,
  captureWindowState,
  listenToWindowStateChanges,
  loadWorkspaceState,
  resetWorkspaceState,
  saveWorkspaceState,
} from "./terminal/workspacePersistence";
import { usePreferencesStore } from "./terminal/preferencesStore";
import {
  themePresetForPreference,
  type Preferences,
  type ThemePreference,
} from "./terminal/preferencesModel";

const CURRENT_APP_VERSION = packageJson.version;

function TitleBar() {
  const startWindowDrag = (event: MouseEvent<HTMLDivElement>) => {
    if (event.button !== 0 || event.detail > 1) return;
    event.preventDefault();
    void getCurrentWindow().startDragging().catch(() => {});
  };

  const toggleWindowZoom = (event: MouseEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    void getCurrentWindow().toggleMaximize().catch(() => {});
  };

  return (
    <div
      className="title-bar"
      onMouseDown={startWindowDrag}
      onDoubleClick={toggleWindowZoom}
    >
      <div className="title-bar-gutter" />
      <div className="title-bar-text">AndSpace</div>
      <div className="title-bar-spacer" />
    </div>
  );
}

function shortenPath(path: string): string {
  const m = path.match(/^\/Users\/[^/]+(\/.*)?$/);
  if (m) return `~${m[1] ?? ""}`;
  return path.length > 48 ? `…${path.slice(-45)}` : path;
}

function StatusBar() {
  const activeTabId = useStore((s) => s.activeTabId);
  const activePaneId = useStore((s) => s.activePaneByTab[activeTabId]);
  const meta = useStore((s) =>
    activePaneId ? s.paneMeta[activePaneId] : undefined
  );
  const cwd = meta?.cwd ? shortenPath(meta.cwd) : "~";

  return (
    <div className="status-bar">
      <div className="status-left">
        <span className="status-dot" aria-hidden />
        <span>zsh</span>
      </div>
      <div className="status-right">
        <span title={meta?.cwd}>{cwd}</span>
      </div>
    </div>
  );
}

function paneFocusDirectionForKey(key: string): PaneFocusDirection | null {
  if (key === "ArrowLeft") return "left";
  if (key === "ArrowRight") return "right";
  if (key === "ArrowUp") return "up";
  if (key === "ArrowDown") return "down";
  return null;
}

interface ToastState {
  message: string;
  tone: "success" | "neutral" | "error";
}

interface PreviewTab extends LocalPreviewTarget {
  id: string;
  reloadKey: number;
}

type NativeShortcut = "split-right" | "split-down";
type NativeMenuAction = NativeShortcut | "preferences.open" | "color-scheme.open";

export default function App() {
  const tabs = useStore((s) => s.tabs);
  const activeTabId = useStore((s) => s.activeTabId);
  const activePaneId = useStore((s) => s.activePaneByTab[s.activeTabId]);
  const activePaneCwd = useStore((s) => {
    const paneId = s.activePaneByTab[s.activeTabId];
    return paneId ? s.paneMeta[paneId]?.cwd : undefined;
  });
  const activePaneCommandEndedAt = useStore((s) => {
    const paneId = s.activePaneByTab[s.activeTabId];
    return paneId ? (s.paneMeta[paneId]?.lastCommandEndedAt ?? 0) : 0;
  });
  const activeHandoffRecord = useStore((s) => {
    const paneId = s.activePaneByTab[s.activeTabId];
    const history = paneId ? s.handoffHistoryByPane[paneId] : undefined;
    return history?.[history.length - 1] ?? null;
  });
  const activeRules = useStore((s) => {
    const paneId = s.activePaneByTab[s.activeTabId];
    return paneId ? s.resolvedRulesByPane[paneId] : undefined;
  });
  const activeSelectedText = useStore((s) => {
    const paneId = s.activePaneByTab[s.activeTabId];
    return paneId ? (s.selectedTextByPane[paneId] ?? "") : "";
  });
  const newTab = useStore((s) => s.newTab);
  const restoreWorkspace = useStore((s) => s.restoreWorkspace);
  const closeTab = useStore((s) => s.closeTab);
  const closeActive = useStore((s) => s.closeActive);
  const splitActive = useStore((s) => s.splitActive);
  const focusPaneInDirection = useStore((s) => s.focusPaneInDirection);
  const writeToPane = useStore((s) => s.writeToPane);
  const nextTab = useStore((s) => s.nextTab);
  const prevTab = useStore((s) => s.prevTab);
  const switchToIndex = useStore((s) => s.switchToIndex);
  const loadRulesForPane = useStore((s) => s.loadRulesForPane);
  const pendingGuardConfirmation = useStore((s) => s.pendingGuardConfirmation);
  const respondToGuardConfirmation = useStore(
    (s) => s.respondToGuardConfirmation
  );
  const [toast, setToast] = useState<ToastState | null>(null);
  const [workspaceReady, setWorkspaceReady] = useState(false);
  const [handoffOpen, setHandoffOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [keybindsOpen, setKeybindsOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarSection, setSidebarSection] = useState<
    "files" | "scripts" | "servers" | "git"
  >("files");
  const sidebarRef = useRef<ProjectSidebarHandle | null>(null);

  const [editors, setEditors] = useState<AvailableEditors>({
    cursor: false,
    code: false,
    nvim: false,
    vim: false,
  });
  const [projectRoot, setProjectRoot] = useState<string | undefined>(undefined);
  const serverCount = useServerStore((s) => s.servers.length);
  const preferences = usePreferencesStore((s) => s.preferences);
  const preferencesLoaded = usePreferencesStore((s) => s.loaded);
  const loadPreferences = usePreferencesStore((s) => s.loadPreferences);
  const savePreferences = usePreferencesStore((s) => s.savePreferences);
  const [fileActionsPath, setFileActionsPath] = useState<string | null>(null);
  const [gitDiffOpen, setGitDiffOpen] = useState(false);
  const [gitDiffPreview, setGitDiffPreview] = useState<GitDiffPreview | null>(
    null
  );
  const [gitDiffLoading, setGitDiffLoading] = useState(false);
  const [gitDiffError, setGitDiffError] = useState<string | null>(null);
  const lastGitFileRef = useRef<{ file: GitChangedFile; cwd: string } | null>(
    null
  );
  const [goToFileOpen, setGoToFileOpen] = useState(false);
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [colorSchemeOpen, setColorSchemeOpen] = useState(false);
  const [savingTheme, setSavingTheme] = useState<ThemePreference | null>(null);
  const [checkingUpdates, setCheckingUpdates] = useState(false);
  const [updateCheckPrompt, setUpdateCheckPrompt] =
    useState<UpdateCheckPrompt | null>(null);
  const [rendererKind, setRendererKind] = useState<string | null>(null);
  const [previewTabs, setPreviewTabs] = useState<PreviewTab[]>([]);
  const [activePreviewId, setActivePreviewId] = useState<string | null>(null);
  const [previewPanelWidth, setPreviewPanelWidth] = useState(520);
  const [pickerTree, setPickerTree] = useState<ProjectTree | null>(null);
  const [pickerLoading, setPickerLoading] = useState(false);
  const lastSplitShortcutRef = useRef<{ action: NativeShortcut; at: number } | null>(
    null
  );
  const workspaceReadyRef = useRef(false);
  const saveWorkspaceTimerRef = useRef<number | null>(null);
  const workspaceFingerprint = useStore((s) =>
    JSON.stringify({
      tabs: s.tabs,
      activeTabId: s.activeTabId,
      activePaneByTab: s.activePaneByTab,
      paneCwds: Object.fromEntries(
        Object.entries(s.paneMeta).map(([paneId, meta]) => [
          paneId,
          meta.cwd ?? "",
        ])
      ),
    })
  );

  const focusSidebar = useCallback(() => {
    setSidebarOpen(true);
    // Wait for the open transition to apply so the first focusable element
    // is actually in the layout when we try to focus it.
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        sidebarRef.current?.focus();
      });
    });
  }, []);

  const showToast = useCallback((next: ToastState) => {
    setToast(next);
    window.setTimeout(() => setToast(null), 2800);
  }, []);

  const handoffProjectContext = useMemo(
    () => activeRules?.projectContext.map((item) => item.value) ?? [],
    [activeRules]
  );
  const sidebarCwd = projectRoot ?? activePaneCwd;
  const gitRefreshKey = `${activePaneId ?? ""}:${sidebarCwd ?? ""}:${activePaneCommandEndedAt}`;
  const onboardingOpen = preferencesLoaded && !preferences.onboardingCompleted;
  const preferredFileAction = preferences.workflow.defaultFileAction;

  const refocusTerminal = useCallback(() => {
    window.setTimeout(() => {
      window.dispatchEvent(new Event("andspace-refocus-terminal"));
    }, 0);
  }, []);

  const savePreferencesDraft = useCallback(
    async (next: Preferences) => {
      try {
        await savePreferences(next);
        setPreferencesOpen(false);
        showToast({ tone: "success", message: "Saved preferences" });
        refocusTerminal();
      } catch (e) {
        showToast({
          tone: "error",
          message: `Could not save preferences: ${String(e)}`,
        });
      }
    },
    [refocusTerminal, savePreferences, showToast]
  );

  const saveThemePreference = useCallback(
    async (theme: ThemePreference) => {
      if (theme === preferences.theme || savingTheme) return;
      setSavingTheme(theme);
      try {
        await savePreferences({ ...preferences, theme });
      } catch (e) {
        showToast({
          tone: "error",
          message: `Could not save color scheme: ${String(e)}`,
        });
      } finally {
        setSavingTheme(null);
      }
    },
    [preferences, savePreferences, savingTheme, showToast]
  );

  const showLocalPreviewTarget = useCallback(
    async (target: LocalPreviewTarget, externalFallbackUrl = target.url) => {
      if (window.innerWidth < 940) {
        await openServerUrl(externalFallbackUrl);
        showToast({
          tone: "neutral",
          message: "Window too narrow for preview. Opened in browser.",
        });
        return;
      }

      const id = target.url;
      setPreviewTabs((tabs) => {
        const existing = tabs.find((tab) => tab.id === id);
        if (existing) {
          return tabs.map((tab) =>
            tab.id === id ? { ...tab, ...target } : tab
          );
        }
        return [...tabs, { ...target, id, reloadKey: 0 }];
      });
      setActivePreviewId(id);
      reportServer("server-open", { url: target.url, label: target.label });
      showToast({ tone: "neutral", message: `Previewing ${target.displayUrl}` });
    },
    [showToast]
  );

  const refreshPreviewTab = useCallback((id: string) => {
    setPreviewTabs((tabs) =>
      tabs.map((tab) =>
        tab.id === id ? { ...tab, reloadKey: tab.reloadKey + 1 } : tab
      )
    );
  }, []);

  const closePreviewTab = useCallback(
    (id: string) => {
      setPreviewTabs((tabs) => {
        const index = tabs.findIndex((tab) => tab.id === id);
        const next = tabs.filter((tab) => tab.id !== id);
        if (activePreviewId === id) {
          const fallback = next[Math.max(0, Math.min(index, next.length - 1))];
          setActivePreviewId(fallback?.id ?? null);
        }
        return next;
      });
    },
    [activePreviewId]
  );

  const openLocalPreview = useCallback(
    async (server: DetectedServer) => {
      const target = buildLocalPreviewTarget(server);
      if (!target) {
        showToast({
          tone: "error",
          message: "Only local development URLs can open in preview",
        });
        return;
      }

      await showLocalPreviewTarget(target, server.url);
    },
    [showLocalPreviewTarget, showToast]
  );

  const openServerFromSidebar = useCallback(
    async (server: DetectedServer) => {
      if (preferences.workflow.serverOpenBehavior === "external") {
        await openServerUrl(server.url);
        return;
      }
      await openLocalPreview(server);
    },
    [openLocalPreview, preferences.workflow.serverOpenBehavior]
  );

  const closeHandoff = useCallback(() => {
    setHandoffOpen(false);
    refocusTerminal();
  }, [refocusTerminal]);

  const closePalette = useCallback(() => {
    setPaletteOpen(false);
    refocusTerminal();
  }, [refocusTerminal]);

  // Slide focus into the sidebar after it opens. Two rAFs so the layout
  // settles (open transition applied → first focusable in tree) before we
  // try to focus, otherwise the call no-ops.
  const focusSidebarSoon = useCallback(() => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        sidebarRef.current?.focus();
      });
    });
  }, []);

  const setSidebarVisible = useCallback(
    (next: boolean) => {
      setSidebarOpen(next);
      void reportSidebarEvent(next ? "sidebar-open" : "sidebar-close");
      if (next) focusSidebarSoon();
      else refocusTerminal();
    },
    [focusSidebarSoon, refocusTerminal]
  );

  const toggleSidebar = useCallback(() => {
    setSidebarOpen((open) => {
      const next = !open;
      void reportSidebarEvent(next ? "sidebar-open" : "sidebar-close");
      if (next) focusSidebarSoon();
      else refocusTerminal();
      return next;
    });
  }, [focusSidebarSoon, refocusTerminal]);

  const runSplitShortcut = useCallback(
    (action: NativeShortcut) => {
      const now = performance.now();
      const last = lastSplitShortcutRef.current;
      if (last?.action === action && now - last.at < 120) return;

      lastSplitShortcutRef.current = { action, at: now };
      splitActive(action === "split-right" ? "row" : "column");
    },
    [splitActive]
  );

  const buildPromptForActivePane = useCallback(async () => {
    return buildAiHandoffPrompt({
      cwd: activeHandoffRecord?.cwd || activePaneCwd || "~",
      command: activeHandoffRecord?.command || null,
      exitCode: activeHandoffRecord?.exitCode ?? null,
      outputLines: activeHandoffRecord?.outputLines ?? [],
      projectContext: handoffProjectContext,
      selectedText: activeSelectedText || null,
      redact: true,
    });
  }, [
    activeHandoffRecord,
    activePaneCwd,
    activeSelectedText,
    handoffProjectContext,
  ]);

  const sendPromptToCli = useCallback(
    async (
      target: AiCliTarget,
      prompt: HandoffPrompt,
      record: HandoffCommandRecord | null
    ) => {
      if (!activePaneId) return;
      await reportAiHandoffEvent("handoff-send", activePaneId, prompt, record, {
        target,
      });
      try {
        const handoffCwd = record?.cwd || activePaneCwd || "~";
        const prepared = await prepareAiCliHandoff(
          target,
          prompt.prompt,
          handoffCwd
        );
        const paneId = await splitActive("row");
        if (!paneId) throw new Error("could not create handoff pane");
        await writeToPane(paneId, `${prepared.shellCommand}\n`);
        await reportAiHandoffEvent(
          "handoff-send-success",
          activePaneId,
          prompt,
          record,
          { target }
        );
        setHandoffOpen(false);
        showToast({ tone: "success", message: `Sent prompt to ${target}` });
      } catch (e) {
        const message = String(e);
        await reportAiHandoffEvent(
          "handoff-send-error",
          activePaneId,
          prompt,
          record,
          { target, error: message }
        );
        showToast({
          tone: "error",
          message: `Could not send to ${target}: ${message}`,
        });
      }
    },
    [activePaneCwd, activePaneId, showToast, splitActive, writeToPane]
  );

  const initRulesForActivePane = useCallback(async () => {
    if (!activePaneCwd) {
      showToast({
        tone: "error",
        message: "No active cwd yet. Run a command or wait for shell init.",
      });
      return;
    }
    try {
      const result = await initAndspaceRules(activePaneCwd);
      if (activePaneId) {
        loadRulesForPane(activePaneId, activePaneCwd);
      }
      showToast({
        tone: result.result === "created" ? "success" : "neutral",
        message:
          result.result === "created"
            ? "Created ANDSPACE.md"
            : "ANDSPACE.md already exists",
      });
    } catch (e) {
      showToast({
        tone: "error",
        message: `Could not initialize ANDSPACE.md: ${String(e)}`,
      });
    }
  }, [activePaneCwd, activePaneId, loadRulesForPane, showToast]);

  const openGoToFile = useCallback(async () => {
    setGoToFileOpen(true);
    const existing = sidebarRef.current?.getTree() ?? null;
    if (existing) {
      setPickerTree(existing);
      return;
    }
    if (!projectRoot) return;
    setPickerLoading(true);
    try {
      const tree = await loadProjectTree(projectRoot);
      setPickerTree(tree);
    } catch (e) {
      showToast({
        tone: "error",
        message: `Could not load project files: ${String(e)}`,
      });
    } finally {
      setPickerLoading(false);
    }
  }, [projectRoot, showToast]);

  const closeGitDiff = useCallback(() => {
    setGitDiffOpen(false);
    setGitDiffLoading(false);
    setGitDiffError(null);
    refocusTerminal();
  }, [refocusTerminal]);

  const openGitDiff = useCallback(
    async (file: GitChangedFile, status: GitStatus) => {
      const cwd = status.repoRoot ?? projectRoot ?? activePaneCwd;
      if (!cwd) {
        showToast({ tone: "neutral", message: "No Git cwd available" });
        return;
      }
      lastGitFileRef.current = { file, cwd };
      setGitDiffOpen(true);
      setGitDiffPreview(null);
      setGitDiffError(null);
      setGitDiffLoading(true);
      try {
        const preview = await loadGitDiff(cwd, file);
        setGitDiffPreview(preview);
      } catch (e) {
        setGitDiffError(String(e));
      } finally {
        setGitDiffLoading(false);
      }
    },
    [activePaneCwd, projectRoot, showToast]
  );

  const loadFirstGitDiffTarget = useCallback(async () => {
    const existing = lastGitFileRef.current;
    if (existing) return existing;
    const cwd = projectRoot ?? activePaneCwd;
    if (!cwd) return null;
    const status = await loadGitStatus(cwd);
    const file = status.files[0];
    if (!status.isRepo || !file) return null;
    const target = { file, cwd: status.repoRoot ?? cwd };
    lastGitFileRef.current = target;
    return target;
  }, [activePaneCwd, projectRoot]);

  const openGitDiffFromPalette = useCallback(async () => {
    try {
      const target = await loadFirstGitDiffTarget();
      if (!target) {
        showToast({ tone: "neutral", message: "No changed files found" });
        setSidebarSection("git");
        setSidebarVisible(true);
        return;
      }
      await openGitDiff(target.file, {
        isRepo: true,
        repoRoot: target.cwd,
        branch: null,
        files: [target.file],
      });
    } catch (e) {
      setSidebarSection("git");
      setSidebarVisible(true);
      showToast({ tone: "error", message: `Could not load Git diff: ${String(e)}` });
    }
  }, [loadFirstGitDiffTarget, openGitDiff, setSidebarVisible, showToast]);

  const copyGitDiff = useCallback(
    async (preview: GitDiffPreview | null = gitDiffPreview) => {
      if (!preview?.diff || preview.tooLarge) {
        showToast({ tone: "neutral", message: "No diff available to copy" });
        return;
      }
      await navigator.clipboard.writeText(preview.diff);
      await reportGitEvent("git-diff-copy", {
        path: absoluteGitPath(preview.repoRoot, preview.path),
      });
      showToast({ tone: "success", message: "Copied Git diff" });
    },
    [gitDiffPreview, showToast]
  );

  const copyGitDiffFromPalette = useCallback(async () => {
    try {
      const target = await loadFirstGitDiffTarget();
      if (!target) {
        showToast({ tone: "neutral", message: "No changed files found" });
        setSidebarSection("git");
        setSidebarVisible(true);
        return;
      }
      const preview = await loadGitDiff(target.cwd, target.file);
      if (!preview.diff || preview.tooLarge) {
        showToast({
          tone: "neutral",
          message:
            preview.message ?? "No diff available to copy. Open the file instead.",
        });
        return;
      }
      await copyGitDiff(preview);
    } catch (e) {
      showToast({ tone: "error", message: `Could not copy Git diff: ${String(e)}` });
    }
  }, [copyGitDiff, loadFirstGitDiffTarget, setSidebarVisible, showToast]);

  const copyDiagnostics = useCallback(async () => {
    try {
      const base = await getPublicDiagnostics();
      const block = buildDiagnosticBlock(base, {
        activeCwd: activePaneCwd,
        renderer: rendererKind ?? undefined,
        shellIntegration: activePaneCwd ? "cwd detected" : "unknown",
      });
      await navigator.clipboard.writeText(block);
      showToast({ tone: "success", message: "Copied diagnostics" });
    } catch (e) {
      showToast({
        tone: "error",
        message: `Could not copy diagnostics: ${String(e)}`,
      });
    }
  }, [activePaneCwd, rendererKind, showToast]);

  const openUpdateUrl = useCallback(
    async (url: string) => {
      try {
        await invoke("open_url", { url });
        setUpdateCheckPrompt(null);
        refocusTerminal();
      } catch (e) {
        showToast({
          tone: "error",
          message: `Could not open release page: ${String(e)}`,
        });
      }
    },
    [refocusTerminal, showToast]
  );

  const closeUpdateCheck = useCallback(() => {
    setUpdateCheckPrompt(null);
    refocusTerminal();
  }, [refocusTerminal]);

  const runUpdateCheck = useCallback(async () => {
    if (checkingUpdates) return;
    setCheckingUpdates(true);
    showToast({ tone: "neutral", message: "Checking for updates..." });
    try {
      const result = await checkForUpdates(CURRENT_APP_VERSION);
      if (result.status === "newer") {
        setUpdateCheckPrompt({
          kind: "available",
          currentTag: result.currentTag,
          latest: result.latest,
        });
      } else {
        showToast({
          tone: "success",
          message: `You’re up to date — ${result.currentTag}`,
        });
      }
    } catch {
      setUpdateCheckPrompt({
        kind: "error",
        message: "Couldn’t check for updates. Open releases page?",
      });
    } finally {
      setCheckingUpdates(false);
    }
  }, [checkingUpdates, showToast]);

  const runPaletteAction = useCallback(
    async (action: CommandPaletteAction) => {
      await reportCommandPaletteRun(action.id);
      closePalette();
      if (action.id === "terminal.newTab") {
        await newTab();
      } else if (action.id === "terminal.splitRight") {
        await splitActive("row");
      } else if (action.id === "terminal.splitDown") {
        await splitActive("column");
      } else if (action.id === "terminal.closePane") {
        await closeActive();
      } else if (action.id === "sidebar.toggle") {
        toggleSidebar();
      } else if (action.id === "sidebar.focusFiles") {
        setSidebarSection("files");
        setSidebarVisible(true);
      } else if (action.id === "sidebar.focusScripts") {
        setSidebarSection("scripts");
        setSidebarVisible(true);
      } else if (action.id === "sidebar.runScript") {
        setSidebarSection("scripts");
        setSidebarVisible(true);
      } else if (action.id === "project.createAndspace") {
        await initRulesForActivePane();
      } else if (action.id === "project.goToFile") {
        await openGoToFile();
      } else if (action.id === "help.showKeybinds") {
        setKeybindsOpen(true);
      } else if (action.id === "servers.openPreview") {
        const server = useServerStore.getState().mostRecent();
        if (!server) {
          showToast({ tone: "neutral", message: "No local servers detected" });
        } else {
          try {
            await openLocalPreview(server);
          } catch (e) {
            showToast({
              tone: "error",
              message: `Could not open preview: ${String(e)}`,
            });
          }
        }
      } else if (action.id === "servers.copyUrl") {
        const server = useServerStore.getState().mostRecent();
        if (!server) {
          showToast({ tone: "neutral", message: "No local servers detected" });
        } else {
          try {
            await copyServerUrl(server.url);
            showToast({ tone: "neutral", message: "Copied server URL" });
          } catch (e) {
            showToast({ tone: "error", message: `Could not copy URL: ${String(e)}` });
          }
        }
      } else if (action.id === "servers.focus") {
        setSidebarSection("servers");
        setSidebarVisible(true);
      } else if (action.id === "git.focus") {
        setSidebarSection("git");
        setSidebarVisible(true);
      } else if (action.id === "git.refresh") {
        setSidebarSection("git");
        setSidebarVisible(true);
        window.requestAnimationFrame(() => {
          sidebarRef.current?.refreshGitChanges();
        });
      } else if (action.id === "git.openDiff") {
        await openGitDiffFromPalette();
      } else if (action.id === "git.copyDiff") {
        await copyGitDiffFromPalette();
      } else if (action.id === "git.openChangedFile") {
        const cwd = projectRoot ?? activePaneCwd;
        if (!cwd) {
          showToast({ tone: "neutral", message: "No Git cwd available" });
          return;
        }
        try {
          const status = await loadGitStatus(cwd);
          const file = status.files[0];
          if (!status.isRepo || !file || !status.repoRoot) {
            showToast({ tone: "neutral", message: "No changed files found" });
            setSidebarSection("git");
            setSidebarVisible(true);
            return;
          }
          const path = absoluteGitPath(status.repoRoot, file.path);
          await reportGitEvent("git-file-open", { path });
          setFileActionsPath(path);
        } catch (e) {
          setSidebarSection("git");
          setSidebarVisible(true);
          showToast({ tone: "error", message: `Could not load Git: ${String(e)}` });
        }
      } else if (action.id === "workspace.restore") {
        const snapshot = await loadWorkspaceState();
        if (!snapshot) {
          showToast({ tone: "neutral", message: "No saved workspace found" });
          return;
        }
        await applyWindowState(snapshot.window);
        setSidebarSection(snapshot.sidebar.focusedSection);
        setSidebarOpen(snapshot.sidebar.open);
        setProjectRoot(snapshot.projectRoot);
        const restored = await restoreWorkspace(snapshot);
        showToast({
          tone: restored ? "success" : "error",
          message: restored
            ? "Restored saved workspace"
            : "Could not restore saved workspace",
        });
        if (restored) refocusTerminal();
      } else if (action.id === "workspace.reset") {
        try {
          if (saveWorkspaceTimerRef.current !== null) {
            window.clearTimeout(saveWorkspaceTimerRef.current);
            saveWorkspaceTimerRef.current = null;
          }
          await resetWorkspaceState();
          showToast({ tone: "neutral", message: "Reset saved workspace" });
        } catch (e) {
          showToast({
            tone: "error",
            message: `Could not reset workspace: ${String(e)}`,
          });
        }
      } else if (action.id === "preferences.open") {
        setPreferencesOpen(true);
      } else if (action.id === "preferences.colorScheme") {
        setColorSchemeOpen(true);
      } else if (action.id === "handoff.sendContext") {
        setHandoffOpen(true);
      } else if (action.id === "handoff.copyLastPrompt") {
        const prompt = await buildPromptForActivePane();
        await navigator.clipboard.writeText(prompt.prompt);
        if (activePaneId) {
          await reportAiHandoffEvent(
            "handoff-copy",
            activePaneId,
            prompt,
            activeHandoffRecord
          );
        }
        showToast({ tone: "success", message: "Copied redacted handoff prompt" });
      } else if (action.id === "help.copyDiagnostics") {
        await copyDiagnostics();
      } else if (action.id === "help.checkUpdates") {
        await runUpdateCheck();
      }
    },
    [
      activeHandoffRecord,
      activePaneCwd,
      activePaneId,
      buildPromptForActivePane,
      closeActive,
      closePalette,
      copyDiagnostics,
      runUpdateCheck,
      initRulesForActivePane,
      newTab,
      copyGitDiffFromPalette,
      openGitDiffFromPalette,
      openGoToFile,
      openLocalPreview,
      projectRoot,
      refocusTerminal,
      restoreWorkspace,
      setSidebarVisible,
      showToast,
      splitActive,
      toggleSidebar,
      writeToPane,
    ]
  );

  const runProjectScript = useCallback(
    async (script: PackageScript, scripts: PackageScripts) => {
      const paneId = await splitActive("row");
      if (!paneId) {
        showToast({ tone: "error", message: "Could not open script pane" });
        return;
      }
      await writeToPane(paneId, `${scriptCommandForSidebar(script, scripts)}\n`);
    },
    [showToast, splitActive, writeToPane]
  );

  const runFileAction = useCallback(
    async (action: FileAction, path: string) => {
      try {
        if (action.type === "open") {
          await openInExternalEditor(action.tool, path);
          showToast({
            tone: "success",
            message: `Opened in ${action.tool === "cursor" ? "Cursor" : "VS Code"}`,
          });
        } else if (action.type === "nvim-split") {
          const cmd = await buildNvimSplitCommand(path);
          const paneId = await splitActive("row");
          if (!paneId) {
            showToast({ tone: "error", message: "Could not open nvim pane" });
            return;
          }
          await writeToPane(paneId, `${cmd}\n`);
          await reportFileActionEvent("nvim-split", { path });
          showToast({ tone: "success", message: "Opened in Neovim split" });
        } else if (action.type === "copy") {
          await navigator.clipboard.writeText(path);
          await reportFileActionEvent("copy", { path });
          showToast({ tone: "neutral", message: "Copied file path" });
        } else if (action.type === "reveal") {
          await revealInFinder(path);
          showToast({ tone: "neutral", message: "Revealed in Finder" });
        }
      } catch (e) {
        showToast({ tone: "error", message: `Action failed: ${String(e)}` });
      }
    },
    [showToast, splitActive, writeToPane]
  );

  const closeFileActions = useCallback(() => {
    setFileActionsPath(null);
    refocusTerminal();
  }, [refocusTerminal]);

  const closeGoToFile = useCallback(() => {
    setGoToFileOpen(false);
    refocusTerminal();
  }, [refocusTerminal]);

  const disabledPaletteActions = useMemo(() => {
    const disabled = new Set<CommandPaletteActionId>();
    if (!activePaneId) {
      disabled.add("terminal.splitRight");
      disabled.add("terminal.splitDown");
      disabled.add("terminal.closePane");
      disabled.add("handoff.copyLastPrompt");
      disabled.add("sidebar.focusFiles");
      disabled.add("sidebar.focusScripts");
      disabled.add("sidebar.runScript");
      disabled.add("git.openChangedFile");
      disabled.add("git.openDiff");
      disabled.add("git.copyDiff");
    }
    if (!activePaneCwd) {
      disabled.add("project.createAndspace");
      disabled.add("sidebar.focusFiles");
      disabled.add("sidebar.focusScripts");
      disabled.add("sidebar.runScript");
      disabled.add("git.refresh");
      disabled.add("git.openChangedFile");
      disabled.add("git.openDiff");
      disabled.add("git.copyDiff");
    }
    if (!projectRoot) {
      disabled.add("project.goToFile");
    }
    if (!activeHandoffRecord) {
      disabled.add("handoff.copyLastPrompt");
    }
    if (serverCount === 0) {
      disabled.add("servers.openPreview");
      disabled.add("servers.copyUrl");
    }
    return disabled;
  }, [
    activeHandoffRecord,
    activePaneCwd,
    activePaneId,
    projectRoot,
    serverCount,
  ]);

  const saveWorkspaceNow = useCallback(async () => {
    if (!workspaceReadyRef.current) return;
    if (!preferences.safety.workspaceRestoreEnabled) return;
    const state = useStore.getState();
    if (state.tabs.length === 0) return;
    try {
      const windowState = await captureWindowState();
      const snapshot = buildWorkspaceSnapshot({
        tabs: state.tabs,
        activeTabId: state.activeTabId,
        activePaneByTab: state.activePaneByTab,
        paneMeta: state.paneMeta,
        sidebarOpen,
        sidebarSection,
        projectRoot,
        window: windowState,
      });
      await saveWorkspaceState(snapshot);
    } catch (e) {
      console.warn("Failed to save workspace", e);
    }
  }, [preferences.safety.workspaceRestoreEnabled, projectRoot, sidebarOpen, sidebarSection]);

  const scheduleWorkspaceSave = useCallback(() => {
    if (!workspaceReadyRef.current) return;
    if (saveWorkspaceTimerRef.current !== null) {
      window.clearTimeout(saveWorkspaceTimerRef.current);
    }
    saveWorkspaceTimerRef.current = window.setTimeout(() => {
      saveWorkspaceTimerRef.current = null;
      void saveWorkspaceNow();
    }, 400);
  }, [saveWorkspaceNow]);

  // Restore workspace on mount. Guard with a ref because React StrictMode
  // double-invokes effects in dev, and PTY creation is async.
  const didInit = useRef(false);
  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;
    void (async () => {
      let restored = false;
      let loadedPreferences = preferences;
      try {
        loadedPreferences = await loadPreferences();
        const snapshot = loadedPreferences.safety.workspaceRestoreEnabled
          ? await loadWorkspaceState()
          : null;
        if (snapshot && loadedPreferences.safety.workspaceRestoreEnabled) {
          await applyWindowState(snapshot.window);
          setSidebarSection(snapshot.sidebar.focusedSection);
          setSidebarOpen(snapshot.sidebar.open);
          setProjectRoot(snapshot.projectRoot);
          restored = await restoreWorkspace(snapshot);
        }
      } catch (e) {
        console.warn("Failed to load workspace", e);
      }
      if (!restored && useStore.getState().tabs.length === 0) {
        await newTab();
      }
      workspaceReadyRef.current = true;
      setWorkspaceReady(true);
      refocusTerminal();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    workspaceReadyRef.current = workspaceReady;
  }, [workspaceReady]);

  useEffect(() => {
    const preset = themePresetForPreference(preferences.theme);
    const root = document.documentElement;
    root.dataset.andspaceTheme = preferences.theme;
    root.style.setProperty("--theme-app-bg", preset.css.appBg);
    root.style.setProperty("--theme-chrome-bg", preset.css.chromeBg);
    root.style.setProperty("--theme-terminal-bg", preset.css.terminalBg);
    root.style.setProperty("--theme-surface", preset.css.surface);
    root.style.setProperty("--theme-accent", preset.css.accent);
    root.style.setProperty("--theme-accent-soft", preset.css.accentSoft);
    root.style.setProperty("--theme-active-border", preset.css.activeBorder);
  }, [preferences.theme]);

  useEffect(() => {
    if (!workspaceReady) return;
    scheduleWorkspaceSave();
  }, [
    projectRoot,
    scheduleWorkspaceSave,
    sidebarOpen,
    sidebarSection,
    workspaceFingerprint,
    workspaceReady,
  ]);

  useEffect(() => {
    const onRenderer = (event: Event) => {
      const detail = (event as CustomEvent<{ kind?: string }>).detail;
      if (detail?.kind) setRendererKind(detail.kind);
    };
    window.addEventListener("andspace:renderer", onRenderer);
    return () => window.removeEventListener("andspace:renderer", onRenderer);
  }, []);

  useEffect(() => {
    const onPreviewUrl = (event: Event) => {
      const detail = (event as CustomEvent<{ url?: string }>).detail;
      if (!detail?.url) return;
      const target = buildLocalPreviewTargetFromUrl(detail.url);
      if (!target) {
        showToast({
          tone: "error",
          message: "Only local development URLs can open in preview",
        });
        return;
      }
      void showLocalPreviewTarget(target, detail.url);
    };
    window.addEventListener("andspace:preview-url", onPreviewUrl);
    return () =>
      window.removeEventListener("andspace:preview-url", onPreviewUrl);
  }, [showLocalPreviewTarget, showToast]);

  useEffect(() => {
    if (!workspaceReady) return;
    let disposed = false;
    let unlisten: (() => void) | null = null;
    listenToWindowStateChanges(scheduleWorkspaceSave)
      .then((fn) => {
        if (disposed) fn();
        else unlisten = fn;
      })
      .catch(() => {});
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [scheduleWorkspaceSave, workspaceReady]);

  // App-level keyboard shortcuts.
  //
  // Priority model:
  //  1. Command Guard pending → block ALL Cmd shortcuts; only Guard's own
  //     buttons / Enter / Esc work.
  //  2. Any other overlay open → block all Cmd shortcuts so users can't
  //     stack overlays. Each overlay, including Git Diff, owns its own
  //     Escape handler.
  //  3. Otherwise → fire the matching shortcut.
  const anyOverlayOpen =
    handoffOpen ||
    paletteOpen ||
    keybindsOpen ||
    preferencesOpen ||
    colorSchemeOpen ||
    onboardingOpen ||
    updateCheckPrompt !== null ||
    fileActionsPath !== null ||
    gitDiffOpen ||
    goToFileOpen;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.metaKey || e.ctrlKey) return;
      if (pendingGuardConfirmation || anyOverlayOpen) return;
      const k = e.key;

      if (e.altKey) return;

      {
        const direction = paneFocusDirectionForKey(k);
        if (direction && !e.shiftKey) {
          e.preventDefault();
          if (direction === "left") {
            const paneId = focusPaneInDirection(direction);
            if (!paneId) focusSidebar();
            return;
          }
          focusPaneInDirection(direction);
          return;
        }
      }

      if (k === "t") {
        e.preventDefault();
        newTab();
      } else if (k === "w") {
        e.preventDefault();
        closeActive();
      } else if (k.toLowerCase() === "b" && !e.shiftKey) {
        e.preventDefault();
        toggleSidebar();
      } else if (k.toLowerCase() === "o" && !e.shiftKey) {
        e.preventDefault();
        runSplitShortcut("split-right");
      } else if (k.toLowerCase() === "l" && !e.shiftKey) {
        e.preventDefault();
        runSplitShortcut("split-down");
      } else if (k === "0" && !e.shiftKey) {
        e.preventDefault();
        focusSidebar();
      } else if (k.toLowerCase() === "i" && e.shiftKey) {
        e.preventDefault();
        void initRulesForActivePane();
      } else if (k.toLowerCase() === "e" && !e.shiftKey) {
        e.preventDefault();
        setHandoffOpen(true);
      } else if (k.toLowerCase() === "k" && !e.shiftKey) {
        e.preventDefault();
        setPaletteOpen(true);
        void reportCommandPaletteOpen();
      } else if (k === "," && !e.shiftKey) {
        e.preventDefault();
        setPreferencesOpen(true);
      } else if (k.toLowerCase() === "p" && !e.shiftKey) {
        e.preventDefault();
        setColorSchemeOpen(true);
      } else if (k === "/" || k === "?") {
        e.preventDefault();
        setKeybindsOpen(true);
      } else if (k === "]") {
        e.preventDefault();
        nextTab();
      } else if (k === "[") {
        e.preventDefault();
        prevTab();
      } else if (/^[1-9]$/.test(k)) {
        e.preventDefault();
        switchToIndex(parseInt(k, 10) - 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    activeTabId,
    activePaneCwd,
    activePaneId,
    anyOverlayOpen,
    initRulesForActivePane,
    newTab,
    closeTab,
    closeActive,
    focusPaneInDirection,
    runSplitShortcut,
    toggleSidebar,
    setColorSchemeOpen,
    focusSidebar,
    nextTab,
    prevTab,
    switchToIndex,
    loadRulesForPane,
    pendingGuardConfirmation,
    showToast,
  ]);

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | null = null;

    listen<NativeMenuAction>("native-shortcut", (event) => {
      if (pendingGuardConfirmation || anyOverlayOpen) return;
      if (event.payload === "preferences.open") {
        setPreferencesOpen(true);
        return;
      }
      if (event.payload === "color-scheme.open") {
        setColorSchemeOpen(true);
        return;
      }
      if (event.payload !== "split-right" && event.payload !== "split-down") {
        return;
      }
      runSplitShortcut(event.payload);
    }).then((fn) => {
      if (disposed) fn();
      else unlisten = fn;
    });

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [anyOverlayOpen, pendingGuardConfirmation, runSplitShortcut]);

  useEffect(() => {
    if (activePaneId && activePaneCwd) {
      loadRulesForPane(activePaneId, activePaneCwd);
    }
  }, [activePaneId, activePaneCwd, loadRulesForPane]);

  useEffect(() => {
    lastGitFileRef.current = null;
  }, [sidebarCwd]);

  // Detect external editors once at startup. Result is cached for the
  // session — re-detecting on every overlay open would add latency for
  // basically no benefit (PATH rarely changes mid-session).
  useEffect(() => {
    let cancelled = false;
    detectExternalEditors()
      .then((next) => {
        if (!cancelled) setEditors(next);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Resolve project root whenever the active pane's cwd changes. The sidebar
  // displays this resolved root instead of the raw cwd — feels saner when the
  // user is buried inside `src/components/...`.
  useEffect(() => {
    if (!activePaneCwd) {
      setProjectRoot(undefined);
      return;
    }
    let cancelled = false;
    setProjectRoot(undefined);
    resolveProjectRoot(activePaneCwd)
      .then((resolved) => {
        if (!cancelled) setProjectRoot(resolved.root);
      })
      .catch(() => {
        if (!cancelled) setProjectRoot(activePaneCwd);
      });
    return () => {
      cancelled = true;
    };
  }, [activePaneCwd]);

  const activePreviewTab =
    previewTabs.find((tab) => tab.id === activePreviewId) ?? null;

  return (
    <div className="app">
      <TitleBar />
      <TabStrip />
      <div className={`workspace ${sidebarOpen ? "sidebar-open" : ""}`}>
        <ProjectSidebar
          ref={sidebarRef}
          open={sidebarOpen}
          cwd={sidebarCwd}
          gitRefreshKey={gitRefreshKey}
          focusedSection={sidebarSection}
          onFocusedSectionChange={setSidebarSection}
          onRunScript={runProjectScript}
          onFileAction={(path) => setFileActionsPath(path)}
          onFileDefault={(path) => {
            void runFileAction(defaultActionFor(editors, preferredFileAction), path);
          }}
          onGitDiff={openGitDiff}
          onServerPreview={(server) => void openServerFromSidebar(server)}
          onServerOpenExternal={(server) => {
            void openServerUrl(server.url).catch((e) =>
              showToast({ message: `Could not open URL: ${String(e)}`, tone: "error" })
            );
          }}
          onToast={(message, tone) => showToast({ message, tone })}
        />
        <div className="terminal-area">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              className={`tab-content ${tab.id === activeTabId ? "active" : ""}`}
            >
              <SplitTree node={tab.root} tabId={tab.id} />
            </div>
          ))}
        </div>
        <LocalPreviewPanel
          tabs={previewTabs}
          activeId={activePreviewId}
          width={previewPanelWidth}
          onResize={setPreviewPanelWidth}
          onSelect={setActivePreviewId}
          onCloseTab={closePreviewTab}
          onRefresh={() => {
            if (activePreviewId) refreshPreviewTab(activePreviewId);
          }}
          onOpenExternal={() => {
            if (!activePreviewTab) return;
            void openServerUrl(activePreviewTab.url).catch((e) =>
              showToast({
                message: `Could not open URL: ${String(e)}`,
                tone: "error",
              })
            );
          }}
          onClose={() => {
            setPreviewTabs([]);
            setActivePreviewId(null);
            refocusTerminal();
          }}
        />
      </div>
      <GuardConfirmationOverlay
        request={pendingGuardConfirmation}
        onRespond={respondToGuardConfirmation}
      />
      <HandoffOverlay
        open={
          !pendingGuardConfirmation &&
          !preferencesOpen &&
          !colorSchemeOpen &&
          !onboardingOpen &&
          handoffOpen
        }
        paneId={activePaneId}
        cwd={activePaneCwd}
        record={activeHandoffRecord}
        projectContext={handoffProjectContext}
        selectedText={activeSelectedText}
        defaultTarget={preferences.workflow.defaultAiCli}
        onSendToCli={sendPromptToCli}
        onClose={closeHandoff}
        onToast={(message, tone) => showToast({ message, tone })}
      />
      <CommandPaletteOverlay
        open={
          !pendingGuardConfirmation &&
          !handoffOpen &&
          !keybindsOpen &&
          !gitDiffOpen &&
          !preferencesOpen &&
          !colorSchemeOpen &&
          !onboardingOpen &&
          paletteOpen
        }
        disabledActions={disabledPaletteActions}
        onRun={runPaletteAction}
        onClose={closePalette}
      />
      <FileActionsOverlay
        open={
          !pendingGuardConfirmation &&
          !handoffOpen &&
          !paletteOpen &&
          !keybindsOpen &&
          !gitDiffOpen &&
          !preferencesOpen &&
          !colorSchemeOpen &&
          !onboardingOpen &&
          fileActionsPath !== null
        }
        path={fileActionsPath}
        editors={editors}
        onClose={closeFileActions}
        onAction={(action) => {
          if (fileActionsPath) {
            void runFileAction(action, fileActionsPath);
          }
          closeFileActions();
        }}
      />
      <GitDiffOverlay
        open={
          !pendingGuardConfirmation &&
          !handoffOpen &&
          !paletteOpen &&
          !keybindsOpen &&
          !preferencesOpen &&
          !colorSchemeOpen &&
          !onboardingOpen &&
          fileActionsPath === null &&
          gitDiffOpen
        }
        preview={gitDiffPreview}
        loading={gitDiffLoading}
        error={gitDiffError}
        onCopy={() => void copyGitDiff()}
        onOpenExternal={() => {
          if (!gitDiffPreview) return;
          setGitDiffOpen(false);
          setFileActionsPath(absoluteGitPath(gitDiffPreview.repoRoot, gitDiffPreview.path));
        }}
        onClose={closeGitDiff}
      />
      <GoToFileOverlay
        open={
          !pendingGuardConfirmation &&
          !handoffOpen &&
          !paletteOpen &&
          !keybindsOpen &&
          !preferencesOpen &&
          !colorSchemeOpen &&
          !onboardingOpen &&
          !gitDiffOpen &&
          fileActionsPath === null &&
          goToFileOpen
        }
        tree={pickerTree}
        loading={pickerLoading}
        cwd={projectRoot ?? null}
        onClose={closeGoToFile}
        onSelect={(entry, useDefault) => {
          setGoToFileOpen(false);
          if (useDefault) {
            void runFileAction(defaultActionFor(editors, preferredFileAction), entry.path);
            refocusTerminal();
          } else {
            setFileActionsPath(entry.path);
          }
        }}
      />
      <PreferencesOverlay
        open={
          !pendingGuardConfirmation &&
          !colorSchemeOpen &&
          (preferencesOpen || onboardingOpen)
        }
        mode={onboardingOpen ? "onboarding" : "preferences"}
        preferences={preferences}
        editors={editors}
        onSave={savePreferencesDraft}
        onClose={() => {
          setPreferencesOpen(false);
          refocusTerminal();
        }}
      />
      <ColorSchemeOverlay
        open={
          !pendingGuardConfirmation &&
          !handoffOpen &&
          !paletteOpen &&
          !preferencesOpen &&
          !onboardingOpen &&
          fileActionsPath === null &&
          !gitDiffOpen &&
          !goToFileOpen &&
          colorSchemeOpen
        }
        theme={preferences.theme}
        savingTheme={savingTheme}
        onSelect={(theme) => void saveThemePreference(theme)}
        onClose={() => {
          setColorSchemeOpen(false);
          refocusTerminal();
        }}
      />
      <UpdateCheckOverlay
        prompt={pendingGuardConfirmation ? null : updateCheckPrompt}
        onOpenDownload={(url) => void openUpdateUrl(url)}
        onViewReleaseNotes={(url) => void openUpdateUrl(url)}
        onClose={closeUpdateCheck}
      />
      <KeybindsOverlay
        open={
          !pendingGuardConfirmation &&
          !handoffOpen &&
          !paletteOpen &&
          updateCheckPrompt === null &&
          !preferencesOpen &&
          !colorSchemeOpen &&
          !onboardingOpen &&
          fileActionsPath === null &&
          !gitDiffOpen &&
          !goToFileOpen &&
          keybindsOpen
        }
        onClose={() => {
          setKeybindsOpen(false);
          refocusTerminal();
        }}
      />
      {toast && (
        <div className={`app-toast ${toast.tone}`} role="status">
          {toast.message}
        </div>
      )}
      <StatusBar />
    </div>
  );
}
