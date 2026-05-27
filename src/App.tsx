import { useEffect, useRef } from "react";
import { useStore } from "./terminal/terminalStore";
import { TabStrip } from "./terminal/TabStrip";
import { SplitTree } from "./terminal/SplitTree";

function TitleBar() {
  return (
    <div className="title-bar" data-tauri-drag-region>
      <div className="title-bar-gutter" />
      <div className="title-bar-text">AndSpace</div>
      <div className="title-bar-spacer" />
    </div>
  );
}

function BranchIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M5 3.5 V12.5 M11 3.5 V7.5 a3 3 0 0 1 -3 3 H5"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      <circle cx="5" cy="3" r="1.4" fill="currentColor" />
      <circle cx="11" cy="3" r="1.4" fill="currentColor" />
      <circle cx="5" cy="13" r="1.4" fill="currentColor" />
    </svg>
  );
}

function StatusBar() {
  // Placeholders matching the design reference — these will become live in v0.1
  // (shell name, cursor position from PTY parsing, current branch from git).
  return (
    <div className="status-bar">
      <div className="status-left">
        <span className="status-dot" aria-hidden />
        <span>zsh</span>
      </div>
      <div className="status-right">
        <span>Ln 1, Col 1</span>
        <span>Spaces: 2</span>
        <span className="status-branch">
          <BranchIcon />
          main
        </span>
      </div>
    </div>
  );
}

export default function App() {
  const tabs = useStore((s) => s.tabs);
  const activeTabId = useStore((s) => s.activeTabId);
  const newTab = useStore((s) => s.newTab);
  const closeTab = useStore((s) => s.closeTab);
  const closeActive = useStore((s) => s.closeActive);
  const splitActive = useStore((s) => s.splitActive);
  const nextTab = useStore((s) => s.nextTab);
  const prevTab = useStore((s) => s.prevTab);
  const switchToIndex = useStore((s) => s.switchToIndex);

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
    newTab,
    closeTab,
    closeActive,
    splitActive,
    nextTab,
    prevTab,
    switchToIndex,
  ]);

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
      <StatusBar />
    </div>
  );
}
