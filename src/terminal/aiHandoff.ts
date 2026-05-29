import { invoke } from "@tauri-apps/api/core";

const DEFAULT_OUTPUT_LINES = 80;
const MAX_OUTPUT_BYTES = 32 * 1024;

interface OutputCapture {
  bytes: Uint8Array;
  truncated: boolean;
}

export interface HandoffCommandRecord {
  command: string;
  cwd: string;
  exitCode: number;
  startedAt: number;
  endedAt: number;
  outputLines: string[];
  outputLineCount: number;
  outputTruncated: boolean;
}

export interface HandoffPromptInput {
  cwd: string;
  command: string | null;
  exitCode: number | null;
  outputLines: string[];
  projectContext: string[];
  selectedText?: string | null;
  redact?: boolean;
}

export interface HandoffPrompt {
  prompt: string;
  redactionCount: number;
  outputLineCount: number;
}

export type AiCliTarget = "claude" | "codex" | "cursor";

export interface AiCliTool {
  target: AiCliTarget;
  label: string;
  command: string;
  available: boolean;
  path: string | null;
}

export interface PreparedAiHandoff {
  target: AiCliTarget;
  promptPath: string;
  shellCommand: string;
}

const captures = new Map<string, OutputCapture>();

export function startOutputCapture(paneId: string) {
  captures.set(paneId, { bytes: new Uint8Array(0), truncated: false });
}

export function appendOutputCapture(paneId: string, chunk: string) {
  if (!captures.has(paneId) || chunk.length === 0) return;
  appendOutputCaptureBytes(paneId, new TextEncoder().encode(chunk));
}

export function appendOutputCaptureBytes(paneId: string, chunk: Uint8Array) {
  const capture = captures.get(paneId);
  if (!capture || chunk.length === 0) return;

  if (chunk.length >= MAX_OUTPUT_BYTES) {
    capture.bytes = chunk.slice(chunk.length - MAX_OUTPUT_BYTES);
    capture.truncated = true;
    return;
  }

  const next = new Uint8Array(capture.bytes.length + chunk.length);
  next.set(capture.bytes, 0);
  next.set(chunk, capture.bytes.length);
  if (next.length > MAX_OUTPUT_BYTES) {
    capture.bytes = next.slice(next.length - MAX_OUTPUT_BYTES);
    capture.truncated = true;
  } else {
    capture.bytes = next;
  }
}

export function finishOutputCapture(paneId: string): {
  outputLines: string[];
  outputLineCount: number;
  outputTruncated: boolean;
} {
  const capture = captures.get(paneId);
  captures.delete(paneId);

  if (!capture) {
    return { outputLines: [], outputLineCount: 0, outputTruncated: false };
  }

  const text = new TextDecoder().decode(capture.bytes);
  const allLines = normalizeCapturedOutput(text);
  const outputLines = allLines.slice(-DEFAULT_OUTPUT_LINES);
  return {
    outputLines,
    outputLineCount: outputLines.length,
    outputTruncated:
      capture.truncated || allLines.length > DEFAULT_OUTPUT_LINES,
  };
}

export function clearOutputCapture(paneId: string) {
  captures.delete(paneId);
}

export function buildAiHandoffPrompt(
  input: HandoffPromptInput
): Promise<HandoffPrompt> {
  return invoke<HandoffPrompt>("build_ai_handoff_prompt", { input });
}

export function detectAiCliTools(): Promise<AiCliTool[]> {
  return invoke<AiCliTool[]>("detect_ai_cli_tools");
}

export function prepareAiCliHandoff(
  target: AiCliTarget,
  prompt: string,
  cwd: string
): Promise<PreparedAiHandoff> {
  return invoke<PreparedAiHandoff>("prepare_ai_cli_handoff", {
    target,
    prompt,
    cwd,
  });
}

export function reportAiHandoffEvent(
  event:
    | "handoff-open"
    | "handoff-copy"
    | "handoff-preview"
    | "handoff-send"
    | "handoff-send-error"
    | "handoff-send-success",
  paneId: string,
  prompt: HandoffPrompt,
  record: HandoffCommandRecord | null,
  options?: { target?: AiCliTarget; error?: string }
): Promise<void> {
  return invoke("report_ai_handoff_event", {
    event,
    paneId,
    command: record?.command ?? null,
    exitCode: record?.exitCode ?? null,
    outputLineCount: prompt.outputLineCount,
    redactionCount: prompt.redactionCount,
    target: options?.target ?? null,
    error: options?.error ?? null,
  });
}

function normalizeCapturedOutput(text: string): string[] {
  const withoutOsc = text.replace(/\x1b\][\s\S]*?(?:\x07|\x1b\\)/g, "");
  const withoutCsi = withoutOsc.replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, "");
  const withoutBackspace = withoutCsi.replace(/[^\n]\x08/g, "");
  const normalized = withoutBackspace
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\x00/g, "");
  const lines = normalized.split("\n").map((line) => line.trimEnd());

  while (lines[0] === "") lines.shift();
  while (lines[lines.length - 1] === "") lines.pop();

  return lines;
}
