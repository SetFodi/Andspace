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
