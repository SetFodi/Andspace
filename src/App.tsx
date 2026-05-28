import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "./terminal/terminalStore";
import { TabStrip } from "./terminal/TabStrip";
import { SplitTree } from "./terminal/SplitTree";
import { GuardConfirmationOverlay } from "./terminal/GuardConfirmationOverlay";
import { HandoffOverlay } from "./terminal/HandoffOverlay";
import { initAndspaceRules } from "./terminal/rules";

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

  const showToast = useCallback((next: ToastState) => {
    setToast(next);
    window.setTimeout(() => setToast(null), 2800);
  }, []);

  const handoffProjectContext = useMemo(
    () => activeRules?.projectContext.map((item) => item.value) ?? [],
    [activeRules]
  );

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
        if (!activePaneCwd) {
          showToast({
            tone: "error",
            message: "No active cwd yet. Run a command or wait for shell init.",
          });
          return;
        }
        initAndspaceRules(activePaneCwd)
          .then((result) => {
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
          })
          .catch((e) =>
            showToast({
              tone: "error",
              message: `Could not initialize ANDSPACE.md: ${String(e)}`,
            })
          );
      } else if (k.toLowerCase() === "e" && !e.shiftKey) {
        e.preventDefault();
        setHandoffOpen(true);
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
    newTab,
    closeTab,
    closeActive,
    splitActive,
    nextTab,
    prevTab,
    switchToIndex,
    loadRulesForPane,
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
        open={handoffOpen}
        paneId={activePaneId}
        cwd={activePaneCwd}
        record={activeHandoffRecord}
        projectContext={handoffProjectContext}
        selectedText={activeSelectedText}
        onClose={() => setHandoffOpen(false)}
        onToast={(message, tone) => showToast({ message, tone })}
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
