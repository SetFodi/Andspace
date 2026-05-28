import type { Terminal } from "@xterm/xterm";
import { invoke } from "@tauri-apps/api/core";
import type { PaneId } from "./types";

export const ANDSPACE_OSC_ID = 9001;

export type ShellOscKind = "cwd" | "start" | "cmd" | "end" | "guard-request";

export interface ShellOscEvent {
  kind: ShellOscKind;
  cwd?: string;
  command?: string;
  exitCode?: number;
  timestamp?: number;
  requestId?: string;
  paneId?: string;
  decision?: "protected" | "dangerous";
  severity?: "confirm" | "type-to-confirm";
  matchedRule?: string;
  matchedSource?: "project" | "user" | "builtin";
  matchedPatternType?: "substring" | "regex";
}

function decodeBase64Utf8(b64: string): string {
  try {
    const binary = atob(b64);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return "";
  }
}

export function parseOsc7(data: string): string | null {
  const raw = data.trim();
  if (!raw.startsWith("file://")) {
    return raw || null;
  }
  try {
    const url = new URL(raw);
    return decodeURIComponent(url.pathname) || "/";
  } catch {
    const slash = raw.indexOf("/", "file://".length);
    if (slash === -1) return null;
    return decodeURIComponent(raw.slice(slash)) || "/";
  }
}

export function parseAndspaceOsc9001(data: string): ShellOscEvent | null {
  const parts = data.split("|");
  const tag = parts[0];
  if (tag === "cwd" && parts[1]) {
    return { kind: "cwd", cwd: decodeBase64Utf8(parts[1]) };
  }
  if (tag === "start" && parts[1]) {
    return { kind: "start", timestamp: Number(parts[1]) * 1000 };
  }
  if (tag === "cmd" && parts[1]) {
    return { kind: "cmd", command: decodeBase64Utf8(parts[1]) };
  }
  if (tag === "end" && parts[1] !== undefined) {
    return {
      kind: "end",
      exitCode: Number(parts[1]),
      timestamp: parts[2] ? Number(parts[2]) * 1000 : Date.now(),
    };
  }
  if (tag === "guard-request" && parts.length >= 10) {
    const decision = parts[3] === "dangerous" ? "dangerous" : "protected";
    const severity =
      parts[4] === "type-to-confirm" ? "type-to-confirm" : "confirm";
    const source =
      parts[6] === "user" || parts[6] === "builtin" ? parts[6] : "project";
    const patternType = parts[7] === "regex" ? "regex" : "substring";
    return {
      kind: "guard-request",
      requestId: parts[1],
      paneId: parts[2],
      decision,
      severity,
      matchedRule: decodeBase64Utf8(parts[5]),
      matchedSource: source,
      matchedPatternType: patternType,
      command: decodeBase64Utf8(parts[8]),
      cwd: decodeBase64Utf8(parts[9]),
    };
  }
  return null;
}

function bufferLineIndex(term: Terminal): number {
  const buf = term.buffer.active;
  return buf.baseY + buf.cursorY;
}

function logShell(paneId: PaneId, line: string) {
  invoke("report_shell_event", { paneId, line }).catch(() => {});
}

export interface ShellIntegrationHandlers {
  onOsc: (event: ShellOscEvent, outputBoundary: number) => void;
}

export function installShellIntegration(
  term: Terminal,
  paneId: PaneId,
  handlers: ShellIntegrationHandlers
): { dispose: () => void } {
  const disposables: { dispose: () => void }[] = [];

  const handle = (event: ShellOscEvent) => {
    const boundary = bufferLineIndex(term);
    logShell(
      paneId,
      `osc kind=${event.kind} boundary=${boundary}` +
        (event.cwd ? ` cwd=${event.cwd}` : "") +
        (event.command ? ` cmd=${event.command.slice(0, 80)}` : "") +
        (event.requestId ? ` request=${event.requestId}` : "") +
        (event.exitCode !== undefined ? ` exit=${event.exitCode}` : "")
    );
    handlers.onOsc(event, boundary);
  };

  disposables.push(
    term.parser.registerOscHandler(7, (data) => {
      const cwd = parseOsc7(data);
      if (cwd) handle({ kind: "cwd", cwd });
      return true;
    })
  );

  disposables.push(
    term.parser.registerOscHandler(ANDSPACE_OSC_ID, (data) => {
      const event = parseAndspaceOsc9001(data);
      if (event) handle(event);
      return true;
    })
  );

  return {
    dispose: () => {
      for (const d of disposables) d.dispose();
    },
  };
}
