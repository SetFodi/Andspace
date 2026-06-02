import { useEffect, useMemo, useRef, useState } from "react";
import {
  buildAiHandoffPrompt,
  detectAiCliTools,
  reportAiHandoffEvent,
  type AiCliTarget,
  type AiCliTool,
  type HandoffCommandRecord,
  type HandoffPrompt,
} from "./aiHandoff";
import type { DefaultAiCli } from "./preferencesModel";

interface Props {
  open: boolean;
  paneId: string | undefined;
  cwd: string | undefined;
  record: HandoffCommandRecord | null;
  projectContext: string[];
  selectedText: string;
  defaultTarget: DefaultAiCli;
  onSendToCli: (
    target: AiCliTarget,
    prompt: HandoffPrompt,
    record: HandoffCommandRecord | null
  ) => Promise<void>;
  onSendToClis: (
    targets: AiCliTarget[],
    prompt: HandoffPrompt,
    record: HandoffCommandRecord | null
  ) => Promise<void>;
  onClose: () => void;
  onToast: (message: string, tone: "success" | "neutral" | "error") => void;
}

export function HandoffOverlay({
  open,
  paneId,
  cwd,
  record,
  projectContext,
  selectedText,
  defaultTarget,
  onSendToCli,
  onSendToClis,
  onClose,
  onToast,
}: Props) {
  const [prompt, setPrompt] = useState<HandoffPrompt | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "copied">("idle");
  const [tools, setTools] = useState<AiCliTool[]>([]);
  const [sendingTarget, setSendingTarget] = useState<AiCliTarget | null>(null);
  const [sendingAll, setSendingAll] = useState(false);
  const copyRef = useRef<HTMLButtonElement>(null);
  const defaultSendRef = useRef<HTMLButtonElement>(null);

  const input = useMemo(
    () => ({
      cwd: record?.cwd || cwd || "~",
      command: record?.command || null,
      exitCode: record?.exitCode ?? null,
      outputLines: record?.outputLines ?? [],
      projectContext,
      selectedText: selectedText || null,
      redact: true,
    }),
    [cwd, projectContext, record, selectedText]
  );

  useEffect(() => {
    if (!open) {
      setPrompt(null);
      setPreviewOpen(false);
      setCopyState("idle");
      return;
    }

    setLoading(true);
    Promise.all([buildAiHandoffPrompt(input), detectAiCliTools()])
      .then(([next, detectedTools]) => {
        setPrompt(next);
        setTools(detectedTools);
        if (paneId) {
          void reportAiHandoffEvent("handoff-open", paneId, next, record);
        }
      })
      .catch((e) => {
        console.warn("Failed to build handoff prompt", e);
        onToast("Could not build handoff prompt", "error");
      })
      .finally(() => setLoading(false));
  }, [input, onToast, open, paneId, record]);

  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => {
      if (defaultTarget !== "ask") defaultSendRef.current?.focus();
      else copyRef.current?.focus();
    });
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [defaultTarget, onClose, open]);

  if (!open) return null;

  const copyPrompt = async () => {
    if (!prompt || !paneId) return;
    try {
      await navigator.clipboard.writeText(prompt.prompt);
      await reportAiHandoffEvent("handoff-copy", paneId, prompt, record);
      setCopyState("copied");
      onToast("Copied redacted handoff prompt", "success");
    } catch (e) {
      console.warn("Failed to copy handoff prompt", e);
      onToast("Could not copy handoff prompt", "error");
    }
  };

  const previewPrompt = async () => {
    if (!prompt || !paneId) return;
    setPreviewOpen(true);
    await reportAiHandoffEvent("handoff-preview", paneId, prompt, record);
  };

  const sendPrompt = async (target: AiCliTarget) => {
    if (!prompt) return;
    setSendingTarget(target);
    try {
      await onSendToCli(target, prompt, record);
    } finally {
      setSendingTarget(null);
    }
  };
  const sendToAll = async (targets: AiCliTarget[]) => {
    if (!prompt || targets.length === 0) return;
    setSendingAll(true);
    try {
      await onSendToClis(targets, prompt, record);
    } finally {
      setSendingAll(false);
    }
  };
  const orderedTools = orderToolsByPreference(tools, defaultTarget);
  const availableTargets = orderedTools
    .filter((tool) => tool.available)
    .map((tool) => tool.target);

  return (
    <div
      className="handoff-overlay"
      role="presentation"
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Escape") {
          e.preventDefault();
          onClose();
        }
      }}
    >
      <section
        className="handoff-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="handoff-title"
      >
        <div className="handoff-glow" />
        <div className="handoff-head">
          <div>
            <div className="handoff-kicker">⌘E handoff</div>
            <h2 id="handoff-title">Send context</h2>
          </div>
          <span className="handoff-chip">local CLI</span>
        </div>

        <div className="handoff-summary">
          <div>
            <span>cwd</span>
            <strong title={input.cwd}>{input.cwd}</strong>
          </div>
          <div>
            <span>command</span>
            <strong title={input.command ?? undefined}>
              {input.command ?? "No completed command"}
            </strong>
          </div>
          <div>
            <span>exit</span>
            <strong>{input.exitCode ?? "unknown"}</strong>
          </div>
        </div>

        <p className="handoff-note">
          Builds a redacted prompt from the last command, recent output, selected
          terminal text, and `ANDSPACE.md` Project Context. Local CLI handoff
          uses installed tools only.
        </p>

        {previewOpen && prompt && (
          <pre className="handoff-preview">{prompt.prompt}</pre>
        )}

        <div className="handoff-actions">
          <button
            ref={copyRef}
            className="handoff-button primary"
            disabled={loading || !prompt}
            onClick={copyPrompt}
          >
            {copyState === "copied" ? "Copied" : "Copy prompt"}
          </button>
          <button
            className="handoff-button secondary"
            disabled={loading || !prompt}
            onClick={previewPrompt}
          >
            Preview prompt
          </button>
          {orderedTools.map((tool) => {
            const isDefault = defaultTarget === tool.target;
            return (
            <button
              key={tool.target}
              ref={isDefault ? defaultSendRef : undefined}
              className={`handoff-button ${isDefault ? "primary" : "secondary"}`}
              disabled={
                loading ||
                !prompt ||
                !tool.available ||
                sendingAll ||
                sendingTarget === tool.target
              }
              title={
                tool.available
                  ? tool.path ?? tool.command
                  : `${tool.command} not found in PATH`
              }
              onClick={() => sendPrompt(tool.target)}
            >
              {sendingTarget === tool.target
                ? `Sending to ${tool.label}`
                : `Send to ${tool.label.replace(" Code", "")}${
                    isDefault ? " (default)" : ""
                  }`}
            </button>
            );
          })}
          {availableTargets.length >= 2 && (
            <button
              className="handoff-button secondary"
              disabled={
                loading || !prompt || sendingAll || sendingTarget !== null
              }
              title="Run the same prompt on every installed CLI, each in its own split pane, to compare answers"
              onClick={() => sendToAll(availableTargets)}
            >
              {sendingAll
                ? "Sending to all…"
                : `Compare on all (${availableTargets.length})`}
            </button>
          )}
          <button className="handoff-button ghost" onClick={onClose}>
            Cancel
          </button>
        </div>
      </section>
    </div>
  );
}

function orderToolsByPreference(
  tools: AiCliTool[],
  defaultTarget: DefaultAiCli
): AiCliTool[] {
  if (defaultTarget === "ask") return tools;
  const idx = tools.findIndex((tool) => tool.target === defaultTarget);
  if (idx <= 0) return tools;
  return [tools[idx], ...tools.slice(0, idx), ...tools.slice(idx + 1)];
}
