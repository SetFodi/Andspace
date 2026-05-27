import type { PaneId, SplitNode, TabId } from "./types";
import { TerminalPane } from "./TerminalPane";

interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

// Walk the split tree and emit (paneId, rect) for each leaf, where rect is in
// percent of the container. Rendering all panes as flat siblings with stable
// React keys keeps the TerminalPane instances mounted when the tree changes
// (split / close) — without this xterm gets disposed and scrollback is lost.
function collectPanes(
  node: SplitNode,
  rect: Rect,
  out: Array<[PaneId, Rect]>
): void {
  if (node.kind === "pane") {
    out.push([node.paneId, rect]);
    return;
  }
  if (node.direction === "row") {
    const mid = (rect.left + rect.right) / 2;
    collectPanes(node.a, { ...rect, right: mid }, out);
    collectPanes(node.b, { ...rect, left: mid }, out);
  } else {
    const mid = (rect.top + rect.bottom) / 2;
    collectPanes(node.a, { ...rect, bottom: mid }, out);
    collectPanes(node.b, { ...rect, top: mid }, out);
  }
}

interface Props {
  node: SplitNode;
  tabId: TabId;
}

export function SplitTree({ node, tabId }: Props) {
  const ROOT: Rect = { left: 0, top: 0, right: 100, bottom: 100 };
  const panes: Array<[PaneId, Rect]> = [];
  collectPanes(node, ROOT, panes);

  return (
    <div className="split-layout">
      {panes.map(([paneId, rect]) => (
        <div
          key={paneId}
          className="pane-slot"
          style={{
            left: `${rect.left}%`,
            top: `${rect.top}%`,
            width: `${rect.right - rect.left}%`,
            height: `${rect.bottom - rect.top}%`,
          }}
        >
          <TerminalPane paneId={paneId} tabId={tabId} />
        </div>
      ))}
    </div>
  );
}
