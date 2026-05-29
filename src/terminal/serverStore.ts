import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import {
  createServerDetectionContext,
  inferServerLabel,
  ingestChunk,
  type ServerDetectionContext,
} from "./serverDetection";

export interface DetectedServer {
  url: string;
  host: string;
  port: number;
  label: string;
  paneId: string;
  firstSeenAt: number;
  lastSeenAt: number;
}

interface ServerState {
  servers: DetectedServer[];
  ingestPaneOutput: (paneId: string, chunk: string) => void;
  clearForPane: (paneId: string) => void;
  /// Most-recent server in insertion order; used by palette actions that
  /// don't want to bother with picking.
  mostRecent: () => DetectedServer | null;
}

// Soft cap. Hitting this means something pathological is generating URLs
// and we just drop the oldest to keep memory bounded.
const MAX_SERVERS = 16;

// Per-pane rolling context buffer for label inference. Module-level so the
// store stays serializable.
const contexts = new Map<string, ServerDetectionContext>();

function getContext(paneId: string): ServerDetectionContext {
  let ctx = contexts.get(paneId);
  if (!ctx) {
    ctx = createServerDetectionContext();
    contexts.set(paneId, ctx);
  }
  return ctx;
}

function reportServerEvent(
  event:
    | "server-detected"
    | "server-open"
    | "server-copy"
    | "server-duplicate-ignored"
    | "server-section-empty",
  options: { url?: string; paneId?: string; label?: string } = {}
) {
  void invoke("report_server_event", {
    event,
    url: options.url ?? null,
    paneId: options.paneId ?? null,
    label: options.label ?? null,
  }).catch(() => {});
}

export const reportServer = reportServerEvent;

export function hasServerDetectionTail(paneId: string): boolean {
  return (contexts.get(paneId)?.tail.length ?? 0) > 0;
}

export const useServerStore = create<ServerState>((set, get) => ({
  servers: [],

  ingestPaneOutput(paneId, chunk) {
    if (!chunk) return;
    const ctx = getContext(paneId);
    const parsed = ingestChunk(ctx, chunk);
    if (parsed.length === 0) return;

    const now = Date.now();
    let { servers } = get();
    let changed = false;

    for (const p of parsed) {
      const existingIdx = servers.findIndex((s) => s.url === p.url);
      if (existingIdx !== -1) {
        // Refresh lastSeenAt but keep firstSeenAt + label. Avoid noisy
        // diag lines for the same URL — log once and move on.
        const existing = servers[existingIdx];
        const next = { ...existing, lastSeenAt: now };
        servers = [...servers.slice(0, existingIdx), next, ...servers.slice(existingIdx + 1)];
        reportServerEvent("server-duplicate-ignored", { url: p.url });
        changed = true;
        continue;
      }

      const label = inferServerLabel(ctx.buffer, p);
      const server: DetectedServer = {
        url: p.url,
        host: p.host,
        port: p.port,
        label,
        paneId,
        firstSeenAt: now,
        lastSeenAt: now,
      };
      servers = [...servers, server];
      reportServerEvent("server-detected", {
        url: p.url,
        paneId,
        label,
      });
      changed = true;
    }

    if (servers.length > MAX_SERVERS) {
      servers = servers.slice(-MAX_SERVERS);
    }
    if (changed) set({ servers });
  },

  clearForPane(paneId) {
    contexts.delete(paneId);
    const { servers } = get();
    const next = servers.filter((s) => s.paneId !== paneId);
    if (next.length !== servers.length) set({ servers: next });
  },

  mostRecent() {
    const { servers } = get();
    if (servers.length === 0) return null;
    return [...servers].sort((a, b) => b.lastSeenAt - a.lastSeenAt)[0];
  },
}));

export function openServerUrl(url: string): Promise<void> {
  reportServerEvent("server-open", { url });
  return invoke<void>("open_url", { url });
}

export async function copyServerUrl(url: string): Promise<void> {
  reportServerEvent("server-copy", { url });
  await navigator.clipboard.writeText(url);
}
