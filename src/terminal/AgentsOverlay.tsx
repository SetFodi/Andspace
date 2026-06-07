import { useEffect, useRef, useState } from "react";
import type { AgentSession } from "./types";

interface Props {
  open: boolean;
  sessions: AgentSession[];
  onClose: () => void;
  onJump: (session: AgentSession) => void;
  onKill: (session: AgentSession) => void;
  onDismiss: (id: string) => void;
}

function elapsed(session: AgentSession, now: number): string {
  const end = session.endedAt ?? now;
  const seconds = Math.max(0, Math.round((end - session.startedAt) / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return remainder ? `${minutes}m ${remainder}s` : `${minutes}m`;
}

export function AgentsOverlay({
  open,
  sessions,
  onClose,
  onJump,
  onKill,
  onDismiss,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => rootRef.current?.focus());
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    // Tick so the elapsed time on running agents stays live.
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener("keydown", onKeyDown, true);
      window.clearInterval(tick);
    };
  }, [open, onClose]);

  if (!open) return null;

  const ordered = [...sessions].reverse();
  const running = sessions.filter((s) => s.status === "running").length;

  return (
    <div
      ref={rootRef}
      tabIndex={-1}
      className="agents-overlay"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        className="agents-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="agents-title"
      >
        <div className="agents-head">
          <div>
            <div className="agents-kicker">
              <span className="agents-dot" aria-hidden />
              AGENTS
            </div>
            <h2 id="agents-title">
              {running > 0 ? `${running} running` : "No agents running"}
            </h2>
          </div>
          <kbd className="agents-shortcut">⌘⇧A</kbd>
        </div>

        {ordered.length === 0 ? (
          <div className="agents-empty">
            No agents yet. Press <kbd>⌘E</kbd> to hand a task to a local CLI, or
            use <strong>Compare on all</strong> to run several at once.
          </div>
        ) : (
          <ul className="agents-list">
            {ordered.map((session) => (
              <li key={session.id} className={`agents-row ${session.status}`}>
                <span
                  className={`agents-status agents-status-${session.status} agents-status-${session.target}`}
                  aria-hidden
                />
                <div className="agents-info">
                  <div className="agents-row-head">
                    <span className="agents-label">{session.label}</span>
                    <span className="agents-meta">
                      {session.status === "running"
                        ? "running"
                        : session.status === "done"
                          ? "done"
                          : `exit ${session.exitCode ?? "?"}`}
                      {" · "}
                      {elapsed(session, now)}
                    </span>
                  </div>
                  <div className="agents-task" title={session.task}>
                    {session.task}
                  </div>
                </div>
                <div className="agents-actions">
                  <button
                    type="button"
                    className="agents-btn"
                    onClick={() => onJump(session)}
                    title="Jump to this agent's pane"
                  >
                    Jump
                  </button>
                  {session.status === "running" ? (
                    <button
                      type="button"
                      className="agents-btn danger"
                      onClick={() => onKill(session)}
                      title="Close the pane and stop this agent"
                    >
                      Kill
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="agents-btn"
                      onClick={() => onDismiss(session.id)}
                      title="Remove from this list"
                    >
                      Dismiss
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="agents-footer">
          <span>
            <kbd>Esc</kbd> Close
          </span>
          <span className="agents-foot-hint">
            AndSpace orchestrates the CLIs you already have — it never runs an
            agent of its own.
          </span>
        </div>
      </section>
    </div>
  );
}
