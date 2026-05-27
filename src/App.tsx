import { useEffect, useRef } from "react";
import { useStore } from "./terminal/terminalStore";
import { TabStrip } from "./terminal/TabStrip";
import { SplitTree } from "./terminal/SplitTree";

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
        // Close pane if tab has multiple panes; otherwise close the tab.
        e.preventDefault();
        closeActive();
      } else if (k === "ArrowRight" && !e.shiftKey) {
        // split right (vertical divider) — ⌘→
        e.preventDefault();
        splitActive("row");
      } else if (k === "ArrowDown" && !e.shiftKey) {
        // split down (horizontal divider) — ⌘↓
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
      <TabStrip />
      <div className="terminal-area">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={`tab-content ${
              tab.id === activeTabId ? "active" : ""
            }`}
          >
            <SplitTree node={tab.root} tabId={tab.id} />
          </div>
        ))}
      </div>
    </div>
  );
}
