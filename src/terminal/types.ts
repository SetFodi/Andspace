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
}

export interface PaneMeta {
  cwd?: string;
  lastCommand?: string;
  lastExitCode?: number;
  lastCommandStartedAt?: number;
  lastCommandEndedAt?: number;
  outputBoundary?: number;
  commandRunning?: boolean;
}
