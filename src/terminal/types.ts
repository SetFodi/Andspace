export type PaneId = string;
export type TabId = string;

// CSS flex-direction. `row` = side-by-side (split right), `column` = stacked (split down).
export type SplitDirection = "row" | "column";

export type SplitNode =
  | { kind: "pane"; paneId: PaneId }
  | { kind: "split"; direction: SplitDirection; a: SplitNode; b: SplitNode };

export interface Tab {
  id: TabId;
  title: string;
  root: SplitNode;
}

export interface CommandHistoryEntry {
  command: string;
  exitCode: number;
  startedAt: number;
  endedAt: number;
  outputBoundary: number;
  outputLines?: string[];
  outputLineCount?: number;
  outputTruncated?: boolean;
}

export interface PaneMeta {
  cwd?: string;
  shell?: string;
  shellProfile?: string;
  lastCommand?: string;
  lastExitCode?: number;
  lastCommandStartedAt?: number;
  lastCommandEndedAt?: number;
  outputBoundary?: number;
  commandRunning?: boolean;
}

export type AgentStatus = "running" | "done" | "failed";

// A local AI CLI launched via the ⌘E handoff, tracked so the Agents cockpit
// can show what's running where and let you jump to it.
export interface AgentSession {
  id: string;
  target: "claude" | "codex" | "cursor";
  label: string;
  paneId: PaneId;
  tabId: TabId;
  task: string;
  startedAt: number;
  status: AgentStatus;
  exitCode?: number;
  endedAt?: number;
}
