import { invoke } from "@tauri-apps/api/core";
import {
  availableMonitors,
  getCurrentWindow,
  PhysicalPosition,
  PhysicalSize,
} from "@tauri-apps/api/window";
import type { PersistedWindow, WorkspaceSnapshot } from "./workspaceModel";
import {
  chooseWindowPlacement,
  normalizeWorkspaceSnapshot,
} from "./workspaceModel";

export async function loadWorkspaceState(): Promise<WorkspaceSnapshot | null> {
  const raw = await invoke<unknown | null>("load_workspace_state");
  return normalizeWorkspaceSnapshot(raw);
}

export function saveWorkspaceState(snapshot: WorkspaceSnapshot): Promise<void> {
  return invoke("save_workspace_state", { snapshot });
}

export function resetWorkspaceState(): Promise<void> {
  return invoke("reset_workspace_state");
}

export async function captureWindowState(): Promise<PersistedWindow | undefined> {
  try {
    const current = getCurrentWindow();
    const [position, size] = await Promise.all([
      current.outerPosition(),
      current.outerSize(),
    ]);
    if (size.width < 600 || size.height < 400) return undefined;
    return {
      x: Math.round(position.x),
      y: Math.round(position.y),
      width: Math.round(size.width),
      height: Math.round(size.height),
    };
  } catch {
    return undefined;
  }
}

export async function applyWindowState(
  windowState: PersistedWindow | undefined
): Promise<void> {
  if (!windowState) return;
  try {
    const current = getCurrentWindow();
    let placement = windowState;
    try {
      const monitors = await availableMonitors();
      placement = chooseWindowPlacement(
        windowState,
        monitors.map((monitor) => ({
          x: monitor.workArea.position.x,
          y: monitor.workArea.position.y,
          width: monitor.workArea.size.width,
          height: monitor.workArea.size.height,
        }))
      );
    } catch {
      // If monitor metadata is unavailable, still apply the saved window.
    }
    await current.setSize(new PhysicalSize(placement.width, placement.height));
    await current.setPosition(new PhysicalPosition(placement.x, placement.y));
  } catch {
    // Window restore is best-effort; workspace restore should still proceed.
  }
}

export async function listenToWindowStateChanges(
  handler: () => void
): Promise<() => void> {
  const current = getCurrentWindow();
  const [unlistenResize, unlistenMove] = await Promise.all([
    current.onResized(handler),
    current.onMoved(handler),
  ]);
  return () => {
    unlistenResize();
    unlistenMove();
  };
}
