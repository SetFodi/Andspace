import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ClipboardIcon,
  ExternalLinkIcon,
  FileIcon,
  FolderRevealIcon,
  TerminalSquareIcon,
} from "./SidebarIcons";
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
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) setSelected(0);
  }, [open, path]);

  // Pull focus into the overlay when it opens so arrow keys / Enter work
  // without the user having to click first. Also intercept Escape at the
  // window level so sidebar focus-stealing handlers don't preempt it.
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
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener("keydown", onKeyDown, true);
    };
  }, [open, onClose]);

  if (!open || !path) return null;

  const displayName = path.split("/").pop() ?? path;
  const displayDir = path.slice(0, Math.max(0, path.length - displayName.length - 1));

  return (
    <div
      ref={rootRef}
      tabIndex={-1}
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
          <div className="file-actions-kicker">
            <span className="kicker-dot" aria-hidden />
            FILE
          </div>
          <div className="file-actions-title-row">
            <span className="file-actions-title-icon" aria-hidden>
              <FileIcon width={15} height={15} />
            </span>
            <h2 id="file-actions-title" title={path}>
              {displayName}
            </h2>
          </div>
          {displayDir && (
            <div className="file-actions-sub" title={displayDir}>
              {shorten(displayDir)}
            </div>
          )}
        </div>

        <div className="file-actions-divider" aria-hidden />

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
                <span className="file-actions-item-icon" aria-hidden>
                  {actionIcon(action)}
                </span>
                <span className="file-actions-item-label">{action.label}</span>
                <kbd className="file-actions-item-hint">{actionHint(action)}</kbd>
              </button>
            );
          })}
        </div>

        <div className="file-actions-footer">
          <span>
            <kbd>↑↓</kbd> Navigate
          </span>
          <span>
            <kbd>↵</kbd> Open
          </span>
          <span>
            <kbd>⌘↵</kbd> Default
          </span>
          <span>
            <kbd>Esc</kbd> Close
          </span>
        </div>
      </section>
    </div>
  );
}

function actionKey(action: FileAction): string {
  if (action.type === "open") return `open:${action.tool}`;
  return action.type;
}

function actionIcon(action: FileAction): ReactNode {
  if (action.type === "open") return <ExternalLinkIcon />;
  if (action.type === "nvim-split") return <TerminalSquareIcon />;
  if (action.type === "copy") return <ClipboardIcon />;
  return <FolderRevealIcon />;
}

function actionHint(action: FileAction): string {
  if (action.type === "open") return action.tool === "cursor" ? "cursor" : "code";
  if (action.type === "nvim-split") return "split";
  if (action.type === "copy") return "⌘C";
  return "finder";
}

function shorten(p: string): string {
  return p.replace(/^\/Users\/[^/]+/, "~");
}
