import { useEffect, useRef, useState } from "react";
import type { GuardConfirmationRequest } from "./commandGuard";

interface Props {
  request: GuardConfirmationRequest | null;
  onRespond: (action: "run" | "cancel") => void;
}

const UI_TIMEOUT_MS = 25_000;

function sourceLabel(source: GuardConfirmationRequest["matchedSource"]): string {
  if (source === "builtin") return "built-in";
  return source;
}

export function GuardConfirmationOverlay({ request, onRespond }: Props) {
  const [typed, setTyped] = useState("");
  const cancelRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isDangerous = request?.decision === "dangerous";
  const canRunDangerous = typed === "run";

  useEffect(() => {
    setTyped("");
    if (!request) return;
    const id = requestAnimationFrame(() => {
      if (request.decision === "dangerous") {
        inputRef.current?.focus();
      } else {
        cancelRef.current?.focus();
      }
    });
    return () => cancelAnimationFrame(id);
  }, [request]);

  useEffect(() => {
    if (!request) return;
    const timeout = window.setTimeout(() => onRespond("cancel"), UI_TIMEOUT_MS);
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onRespond("cancel");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [request, onRespond]);

  if (!request) return null;

  return (
    <div className="guard-overlay" role="presentation">
      <section
        className={`guard-card ${isDangerous ? "dangerous" : "protected"}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="guard-title"
      >
        <div className="guard-ribbon" />
        <div className="guard-head">
          <div>
            <div className="guard-kicker">Command Guard</div>
            <h2 id="guard-title">
              {isDangerous ? "Dangerous command" : "Protected command"}
            </h2>
          </div>
          <span className="guard-chip">{sourceLabel(request.matchedSource)}</span>
        </div>

        <div className="guard-command" title={request.command}>
          {request.command}
        </div>

        <dl className="guard-meta">
          <div>
            <dt>Matched rule</dt>
            <dd>{request.matchedRule}</dd>
          </div>
          <div>
            <dt>Source</dt>
            <dd>{sourceLabel(request.matchedSource)}</dd>
          </div>
        </dl>

        {isDangerous && (
          <label className="guard-run-label">
            Type <code>run</code> to continue
            <input
              ref={inputRef}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && canRunDangerous) {
                  e.preventDefault();
                  onRespond("run");
                }
              }}
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
            />
          </label>
        )}

        <div className="guard-actions">
          <button
            ref={cancelRef}
            className="guard-button secondary"
            onClick={() => onRespond("cancel")}
          >
            Cancel
          </button>
          <button
            className="guard-button primary"
            disabled={isDangerous && !canRunDangerous}
            onClick={() => onRespond("run")}
          >
            {isDangerous ? "Run command" : "Run once"}
          </button>
        </div>
      </section>
    </div>
  );
}
