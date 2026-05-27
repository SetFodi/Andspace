import { useStore } from "./terminalStore";

export function TabStrip() {
  const tabs = useStore((s) => s.tabs);
  const activeTabId = useStore((s) => s.activeTabId);
  const setActiveTab = useStore((s) => s.setActiveTab);
  const closeTab = useStore((s) => s.closeTab);
  const newTab = useStore((s) => s.newTab);

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
    </div>
  );
}
