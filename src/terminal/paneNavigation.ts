import type { PaneId, SplitNode } from "./types";

export type PaneFocusDirection = "left" | "right" | "up" | "down";

interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

interface PaneRect {
  paneId: PaneId;
  rect: Rect;
}

const ROOT_RECT: Rect = { left: 0, top: 0, right: 100, bottom: 100 };
const EPSILON = 0.0001;

export function collectPaneRects(
  node: SplitNode,
  rect: Rect = ROOT_RECT,
  out: PaneRect[] = []
): PaneRect[] {
  if (node.kind === "pane") {
    out.push({ paneId: node.paneId, rect });
    return out;
  }

  if (node.direction === "row") {
    const mid = (rect.left + rect.right) / 2;
    collectPaneRects(node.a, { ...rect, right: mid }, out);
    collectPaneRects(node.b, { ...rect, left: mid }, out);
  } else {
    const mid = (rect.top + rect.bottom) / 2;
    collectPaneRects(node.a, { ...rect, bottom: mid }, out);
    collectPaneRects(node.b, { ...rect, top: mid }, out);
  }

  return out;
}

export function findNearestPaneInDirection(
  root: SplitNode,
  activePaneId: PaneId,
  direction: PaneFocusDirection
): PaneId | null {
  const panes = collectPaneRects(root);
  const active = panes.find((pane) => pane.paneId === activePaneId);
  if (!active) return null;

  const activeCenterX = centerX(active.rect);
  const activeCenterY = centerY(active.rect);
  const candidates = panes
    .filter((pane) => pane.paneId !== activePaneId)
    .map((pane) => {
      const overlap =
        direction === "left" || direction === "right"
          ? verticalOverlap(active.rect, pane.rect)
          : horizontalOverlap(active.rect, pane.rect);
      if (overlap <= EPSILON) return null;

      const distance = distanceInDirection(active.rect, pane.rect, direction);
      if (distance === null) return null;

      const crossAxisDistance =
        direction === "left" || direction === "right"
          ? Math.abs(activeCenterY - centerY(pane.rect))
          : Math.abs(activeCenterX - centerX(pane.rect));

      return {
        paneId: pane.paneId,
        distance,
        overlap,
        crossAxisDistance,
      };
    })
    .filter((pane): pane is NonNullable<typeof pane> => pane !== null)
    .sort((a, b) => {
      if (a.distance !== b.distance) return a.distance - b.distance;
      if (a.crossAxisDistance !== b.crossAxisDistance) {
        return a.crossAxisDistance - b.crossAxisDistance;
      }
      if (a.overlap !== b.overlap) return b.overlap - a.overlap;
      return a.paneId.localeCompare(b.paneId);
    });

  return candidates[0]?.paneId ?? null;
}

function distanceInDirection(
  active: Rect,
  candidate: Rect,
  direction: PaneFocusDirection
): number | null {
  if (direction === "left") {
    if (candidate.right > active.left + EPSILON) return null;
    return Math.max(0, active.left - candidate.right);
  }
  if (direction === "right") {
    if (candidate.left < active.right - EPSILON) return null;
    return Math.max(0, candidate.left - active.right);
  }
  if (direction === "up") {
    if (candidate.bottom > active.top + EPSILON) return null;
    return Math.max(0, active.top - candidate.bottom);
  }
  if (candidate.top < active.bottom - EPSILON) return null;
  return Math.max(0, candidate.top - active.bottom);
}

function horizontalOverlap(a: Rect, b: Rect): number {
  return Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
}

function verticalOverlap(a: Rect, b: Rect): number {
  return Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
}

function centerX(rect: Rect): number {
  return (rect.left + rect.right) / 2;
}

function centerY(rect: Rect): number {
  return (rect.top + rect.bottom) / 2;
}
