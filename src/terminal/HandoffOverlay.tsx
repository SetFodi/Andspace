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

interface Props {
  open: boolean;
  paneId: string | undefined;
  cwd: string | undefined;
  record: HandoffCommandRecord | null;
  projectContext: string[];
  selectedText: string;
  onSendToCli: (
    target: AiCliTarget,
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
  onSendToCli,
  onClose,
  onToast,
}: Props) {
  const [prompt, setPrompt] = useState<HandoffPrompt | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "copied">("idle");
  const [tools, setTools] = useState<AiCliTool[]>([]);
  const [sendingTarget, setSendingTarget] = useState<AiCliTarget | null>(null);
  const copyRef = useRef<HTMLButtonElement>(null);

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
    const id = requestAnimationFrame(() => copyRef.current?.focus());
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
  }, [onClose, open]);

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
          {tools.map((tool) => (
            <button
              key={tool.target}
              className="handoff-button secondary"
              disabled={
                loading ||
                !prompt ||
                !tool.available ||
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
                : `Send to ${tool.label.replace(" Code", "")}`}
            </button>
          ))}
          <button className="handoff-button ghost" onClick={onClose}>
            Cancel
          </button>
        </div>
      </section>
    </div>
  );
}
