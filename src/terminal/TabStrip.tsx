import { useStore } from "./terminalStore";

function SplitRightIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect
        x="2.5"
        y="3.5"
        width="4.5"
        height="9"
        rx="1.2"
        stroke="currentColor"
        strokeWidth="1.2"
      />
      <rect
        x="9"
        y="3.5"
        width="4.5"
        height="9"
        rx="1.2"
        stroke="currentColor"
        strokeWidth="1.2"
      />
    </svg>
  );
}

function SplitDownIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect
        x="2.5"
        y="3"
        width="11"
        height="4"
        rx="1.2"
        stroke="currentColor"
        strokeWidth="1.2"
      />
      <rect
        x="2.5"
        y="9"
        width="11"
        height="4"
        rx="1.2"
        stroke="currentColor"
        strokeWidth="1.2"
      />
    </svg>
  );
}

function MoreIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <circle cx="3" cy="8" r="1.3" />
      <circle cx="8" cy="8" r="1.3" />
      <circle cx="13" cy="8" r="1.3" />
    </svg>
  );
}

export function TabStrip() {
  const tabs = useStore((s) => s.tabs);
  const activeTabId = useStore((s) => s.activeTabId);
  const setActiveTab = useStore((s) => s.setActiveTab);
  const closeTab = useStore((s) => s.closeTab);
  const newTab = useStore((s) => s.newTab);
  const splitActive = useStore((s) => s.splitActive);

  return (
    <div className="tab-strip">
      {tabs.map((tab, idx) => (
        <div
          key={tab.id}
          className={`tab ${tab.id === activeTabId ? "active" : ""}`}
          onClick={() => setActiveTab(tab.id)}
        >
          <span className="tab-index">{idx + 1}</span>
          <span className="tab-title">{tab.title}</span>
          <button
            className="tab-close"
            onClick={(e) => {
              e.stopPropagation();
              closeTab(tab.id);
            }}
            aria-label="Close tab"
          >
            ×
          </button>
        </div>
      ))}
      <button className="tab-new" onClick={newTab} aria-label="New tab">
        +
      </button>
      <div className="tab-strip-spacer" />
      <div className="tab-strip-actions">
        <button
          className="strip-icon"
          onClick={() => splitActive("row")}
          title="Split right (⌘→)"
          aria-label="Split right"
        >
          <SplitRightIcon />
        </button>
        <button
          className="strip-icon"
          onClick={() => splitActive("column")}
          title="Split down (⌘↓)"
          aria-label="Split down"
        >
          <SplitDownIcon />
        </button>
        <button className="strip-icon" title="More" aria-label="More">
          <MoreIcon />
        </button>
      </div>
    </div>
  );
}
