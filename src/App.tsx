import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "./terminal/terminalStore";
import { TabStrip } from "./terminal/TabStrip";
import { SplitTree } from "./terminal/SplitTree";
import { GuardConfirmationOverlay } from "./terminal/GuardConfirmationOverlay";
import { HandoffOverlay } from "./terminal/HandoffOverlay";
import { CommandPaletteOverlay } from "./terminal/CommandPaletteOverlay";
import { initAndspaceRules } from "./terminal/rules";
import {
  buildAiHandoffPrompt,
  prepareAiCliHandoff,
  reportAiHandoffEvent,
  type AiCliTarget,
  type HandoffCommandRecord,
  type HandoffPrompt,
} from "./terminal/aiHandoff";
import {
  reportCommandPaletteOpen,
  reportCommandPaletteRun,
  type CommandPaletteAction,
  type CommandPaletteActionId,
} from "./terminal/commandPalette";

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

interface ToastState {
  message: string;
  tone: "success" | "neutral" | "error";
}

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
      } else if (action.id === "project.createAndspace") {
        await initRulesForActivePane();
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
      } else if (action.id === "guard.testProtectedCommand" && activePaneId) {
        await writeToPane(activePaneId, "sudo echo andspace-protected-test\n");
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
      showToast,
      splitActive,
      writeToPane,
    ]
  );

  const disabledPaletteActions = useMemo(() => {
    const disabled = new Set<CommandPaletteActionId>();
    if (!activePaneId) {
      disabled.add("terminal.splitRight");
      disabled.add("terminal.splitDown");
      disabled.add("terminal.closePane");
      disabled.add("handoff.copyLastPrompt");
      disabled.add("guard.testProtectedCommand");
    }
    if (!activePaneCwd) {
      disabled.add("project.createAndspace");
    }
    if (!activeHandoffRecord) {
      disabled.add("handoff.copyLastPrompt");
    }
    return disabled;
  }, [activeHandoffRecord, activePaneCwd, activePaneId]);

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
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key;
      if (k === "t") {
        e.preventDefault();
        newTab();
      } else if (k === "w") {
        e.preventDefault();
        closeActive();
      } else if (k === "ArrowRight" && !e.shiftKey) {
        e.preventDefault();
        splitActive("row");
      } else if (k === "ArrowDown" && !e.shiftKey) {
        e.preventDefault();
        splitActive("column");
      } else if (k.toLowerCase() === "i" && e.shiftKey) {
        e.preventDefault();
        void initRulesForActivePane();
      } else if (k.toLowerCase() === "e" && !e.shiftKey) {
        e.preventDefault();
        if (!pendingGuardConfirmation && !paletteOpen) {
          setHandoffOpen(true);
        }
      } else if (k.toLowerCase() === "k" && !e.shiftKey) {
        e.preventDefault();
        if (!pendingGuardConfirmation && !handoffOpen) {
          setPaletteOpen(true);
          void reportCommandPaletteOpen();
        }
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
    handoffOpen,
    initRulesForActivePane,
    newTab,
    closeTab,
    closeActive,
    splitActive,
    nextTab,
    prevTab,
    switchToIndex,
    loadRulesForPane,
    paletteOpen,
    pendingGuardConfirmation,
    showToast,
  ]);

  useEffect(() => {
    if (activePaneId && activePaneCwd) {
      loadRulesForPane(activePaneId, activePaneCwd);
    }
  }, [activePaneId, activePaneCwd, loadRulesForPane]);

  return (
    <div className="app">
      <TitleBar />
      <TabStrip />
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
        open={!pendingGuardConfirmation && !handoffOpen && paletteOpen}
        disabledActions={disabledPaletteActions}
        onRun={runPaletteAction}
        onClose={closePalette}
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
