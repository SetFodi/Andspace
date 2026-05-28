import { useEffect, useMemo, useState } from "react";
import {
  actionsForFile,
  type AvailableEditors,
  type FileAction,
} from "./fileActions";

interface Props {
  open: boolean;
  path: string | null;
  editors: AvailableEditors;
  onClose: () => void;
  onAction: (action: FileAction) => void;
}

export function FileActionsOverlay({
  open,
  path,
  editors,
  onClose,
  onAction,
}: Props) {
  const [selected, setSelected] = useState(0);
  const actions = useMemo(() => actionsForFile(editors), [editors]);

  useEffect(() => {
    if (open) setSelected(0);
  }, [open, path]);

  if (!open || !path) return null;

  const displayName = path.split("/").pop() ?? path;
  const displayDir = path.slice(0, Math.max(0, path.length - displayName.length - 1));

  return (
    <div
      className="file-actions-overlay"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Escape") {
          e.preventDefault();
          onClose();
        } else if (e.key === "ArrowDown") {
          e.preventDefault();
          setSelected((idx) => (actions.length ? (idx + 1) % actions.length : 0));
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          setSelected((idx) =>
            actions.length ? (idx - 1 + actions.length) % actions.length : 0
          );
        } else if (e.key === "Enter") {
          e.preventDefault();
          const action = actions[selected];
          if (action) onAction(action);
        }
      }}
    >
      <section
        className="file-actions-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="file-actions-title"
      >
        <div className="file-actions-head">
          <div className="file-actions-kicker">File</div>
          <h2 id="file-actions-title" title={path}>
            {displayName}
          </h2>
          {displayDir && (
            <div className="file-actions-sub" title={displayDir}>
              {shorten(displayDir)}
            </div>
          )}
        </div>

        <div className="file-actions-list" role="listbox">
          {actions.map((action, idx) => {
            const key = actionKey(action);
            const active = idx === selected;
            return (
              <button
                key={key}
                className={`file-actions-item ${active ? "active" : ""}`}
                onMouseEnter={() => setSelected(idx)}
                onClick={() => onAction(action)}
              >
                <span>{action.label}</span>
                <em>{actionHint(action)}</em>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function actionKey(action: FileAction): string {
  if (action.type === "open") return `open:${action.tool}`;
  return action.type;
}

function actionHint(action: FileAction): string {
  if (action.type === "open") return action.tool === "cursor" ? "cursor" : "code";
  if (action.type === "nvim-split") return "split + nvim";
  if (action.type === "copy") return "clipboard";
  return "finder";
}

function shorten(p: string): string {
  return p.replace(/^\/Users\/[^/]+/, "~");
}
