import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { useStore } from "./terminal/terminalStore";
import { TabStrip } from "./terminal/TabStrip";
import { SplitTree } from "./terminal/SplitTree";
import { GuardConfirmationOverlay } from "./terminal/GuardConfirmationOverlay";
import { HandoffOverlay } from "./terminal/HandoffOverlay";
import { CommandPaletteOverlay } from "./terminal/CommandPaletteOverlay";
import { FileActionsOverlay } from "./terminal/FileActionsOverlay";
import { GoToFileOverlay } from "./terminal/GoToFileOverlay";
import { KeybindsOverlay } from "./terminal/KeybindsOverlay";
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
  useServerStore,
} from "./terminal/serverStore";
import {
  reportCommandPaletteOpen,
  reportCommandPaletteRun,
  type CommandPaletteAction,
  type CommandPaletteActionId,
} from "./terminal/commandPalette";
import type { PaneFocusDirection } from "./terminal/paneNavigation";

function TitleBar() {
  return (
    <div className="title-bar" data-tauri-drag-region>
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

type NativeShortcut = "split-right" | "split-down";

export default function App() {
  const tabs = useStore((s) => s.tabs);
  const activeTabId = useStore((s) => s.activeTabId);
  const activePaneId = useStore((s) => s.activePaneByTab[s.activeTabId]);
  const activePaneCwd = useStore((s) => {
    const paneId = s.activePaneByTab[s.activeTabId];
    return paneId ? s.paneMeta[paneId]?.cwd : undefined;
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
  const [handoffOpen, setHandoffOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [keybindsOpen, setKeybindsOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarSection, setSidebarSection] = useState<
    "files" | "scripts" | "servers"
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
  const [fileActionsPath, setFileActionsPath] = useState<string | null>(null);
  const [goToFileOpen, setGoToFileOpen] = useState(false);
  const [pickerTree, setPickerTree] = useState<ProjectTree | null>(null);
  const [pickerLoading, setPickerLoading] = useState(false);
  const lastSplitShortcutRef = useRef<{ action: NativeShortcut; at: number } | null>(
    null
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

  const refocusTerminal = useCallback(() => {
    window.setTimeout(() => {
      window.dispatchEvent(new Event("andspace-refocus-terminal"));
    }, 0);
  }, []);

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
        const prepared = await prepareAiCliHandoff(target, prompt.prompt);
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
    [activePaneId, showToast, splitActive, writeToPane]
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
            await openServerUrl(server.url);
            showToast({ tone: "success", message: `Opening ${server.url}` });
          } catch (e) {
            showToast({ tone: "error", message: `Could not open URL: ${String(e)}` });
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
      }
    },
    [
      activeHandoffRecord,
      activePaneId,
      buildPromptForActivePane,
      closeActive,
      closePalette,
      initRulesForActivePane,
      newTab,
      openGoToFile,
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
    }
    if (!activePaneCwd) {
      disabled.add("project.createAndspace");
      disabled.add("sidebar.focusFiles");
      disabled.add("sidebar.focusScripts");
      disabled.add("sidebar.runScript");
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

  // Open the first tab on mount. Guard with a ref because React StrictMode
  // double-invokes effects in dev, and newTab() is async — without this
  // guard we'd create two PTYs at startup.
  const didInit = useRef(false);
  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;
    if (tabs.length === 0) {
      newTab();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // App-level keyboard shortcuts.
  //
  // Priority model:
  //  1. Command Guard pending → block ALL Cmd shortcuts; only Guard's own
  //     buttons / Enter / Esc work.
  //  2. Any other overlay open → block all Cmd shortcuts so users can't
  //     stack overlays. Each overlay owns its own Escape handler.
  //  3. Otherwise → fire the matching shortcut.
  const anyOverlayOpen =
    handoffOpen ||
    paletteOpen ||
    keybindsOpen ||
    fileActionsPath !== null ||
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

    listen<NativeShortcut>("native-shortcut", (event) => {
      if (pendingGuardConfirmation || anyOverlayOpen) return;
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

  return (
    <div className="app">
      <TitleBar />
      <TabStrip />
      <div className={`workspace ${sidebarOpen ? "sidebar-open" : ""}`}>
        <ProjectSidebar
          ref={sidebarRef}
          open={sidebarOpen}
          cwd={projectRoot ?? activePaneCwd}
          focusedSection={sidebarSection}
          onFocusedSectionChange={setSidebarSection}
          onRunScript={runProjectScript}
          onFileAction={(path) => setFileActionsPath(path)}
          onFileDefault={(path) => {
            void runFileAction(defaultActionFor(editors), path);
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
      </div>
      <GuardConfirmationOverlay
        request={pendingGuardConfirmation}
        onRespond={respondToGuardConfirmation}
      />
      <HandoffOverlay
        open={!pendingGuardConfirmation && handoffOpen}
        paneId={activePaneId}
        cwd={activePaneCwd}
        record={activeHandoffRecord}
        projectContext={handoffProjectContext}
        selectedText={activeSelectedText}
        onSendToCli={sendPromptToCli}
        onClose={closeHandoff}
        onToast={(message, tone) => showToast({ message, tone })}
      />
      <CommandPaletteOverlay
        open={
          !pendingGuardConfirmation &&
          !handoffOpen &&
          !keybindsOpen &&
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
      <GoToFileOverlay
        open={
          !pendingGuardConfirmation &&
          !handoffOpen &&
          !paletteOpen &&
          !keybindsOpen &&
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
            void runFileAction(defaultActionFor(editors), entry.path);
            refocusTerminal();
          } else {
            setFileActionsPath(entry.path);
          }
        }}
      />
      <KeybindsOverlay
        open={!pendingGuardConfirmation && keybindsOpen}
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
