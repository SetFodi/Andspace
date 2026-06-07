import { useStore } from "./terminalStore";
import type { PaneMeta, SplitNode } from "./types";
import { aiCliLabelForCommand } from "./aiCli";

function collectPaneIds(node: SplitNode): string[] {
  if (node.kind === "pane") return [node.paneId];
  return [...collectPaneIds(node.a), ...collectPaneIds(node.b)];
}

type TabAgent = { status: "running" | "done" | "failed"; label: string };

// Derive the agent status to show on a tab from its panes' last commands.
// Running wins; otherwise the most recently finished AI CLI.
function tabAgentStatus(
  root: SplitNode,
  paneMeta: Record<string, PaneMeta>
): TabAgent | null {
  let running: TabAgent | null = null;
  let finished: (TabAgent & { endedAt: number }) | null = null;
  for (const id of collectPaneIds(root)) {
    const meta = paneMeta[id];
    if (!meta) continue;
    const label = aiCliLabelForCommand(meta.lastCommand);
    if (!label) continue;
    if (meta.commandRunning) {
      running = { status: "running", label };
    } else {
      const endedAt = meta.lastCommandEndedAt ?? 0;
      const status = (meta.lastExitCode ?? 0) === 0 ? "done" : "failed";
      if (!finished || endedAt > finished.endedAt) {
        finished = { status, label, endedAt };
      }
    }
  }
  if (running) return running;
  if (finished) return { status: finished.status, label: finished.label };
  return null;
}

// Last path segment of the cwd — the meaningful, Ghostty-style tab name.
function dirName(cwd: string | undefined): string | null {
  if (!cwd) return null;
  const trimmed = cwd.replace(/\/+$/, "");
  if (trimmed === "") return "/";
  return trimmed.split("/").pop() || "/";
}

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
  const paneMeta = useStore((s) => s.paneMeta);
  const activePaneByTab = useStore((s) => s.activePaneByTab);

  return (
    <div className="tab-strip">
      {tabs.map((tab, idx) => {
        const agent = tabAgentStatus(tab.root, paneMeta);
        const activePane = activePaneByTab[tab.id];
        const cwd = activePane ? paneMeta[activePane]?.cwd : undefined;
        const dir = dirName(cwd);
        const place = dir ?? tab.title;
        // When an agent is running, show "Agent · folder" (so two Codex tabs in
        // different projects stay distinct); otherwise just the folder.
        const label =
          agent && agent.status === "running"
            ? dir
              ? `${agent.label} · ${dir}`
              : agent.label
            : place;
        return (
          <div
            key={tab.id}
            className={`tab ${tab.id === activeTabId ? "active" : ""}`}
            onClick={() => setActiveTab(tab.id)}
            title={cwd ?? tab.title}
          >
            <span className="tab-index">{idx + 1}</span>
            {agent && agent.status === "running" ? (
              <span
                className={`tab-agent tab-agent-running tab-agent-${agent.label.toLowerCase()}`}
                title={`${agent.label} running`}
                aria-hidden
              />
            ) : agent && tab.id !== activeTabId ? (
              <span
                className={`tab-agent tab-agent-${agent.status}`}
                title={`${agent.label} ${agent.status}`}
                aria-hidden
              />
            ) : null}
            <span className="tab-title">{label}</span>
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
        );
      })}
      <button className="tab-new" onClick={newTab} aria-label="New tab">
        +
      </button>
      <div className="tab-strip-spacer" />
      <div className="tab-strip-actions">
        <button
          className="strip-icon"
          onClick={() => splitActive("row")}
          title="Split right (⌘O)"
          aria-label="Split right"
        >
          <SplitRightIcon />
        </button>
        <button
          className="strip-icon"
          onClick={() => splitActive("column")}
          title="Split down (⌘L)"
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
