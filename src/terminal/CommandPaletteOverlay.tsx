import { useEffect, useMemo, useRef, useState } from "react";
import { SearchIcon } from "./SidebarIcons";
import {
  filterCommandPaletteActions,
  type CommandPaletteAction,
  type CommandPaletteActionId,
} from "./commandPalette";

interface Props {
  open: boolean;
  disabledActions: Set<CommandPaletteActionId>;
  onRun: (action: CommandPaletteAction) => void;
  onClose: () => void;
}

export function CommandPaletteOverlay({
  open,
  disabledActions,
  onRun,
  onClose,
}: Props) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const actions = useMemo(() => filterCommandPaletteActions(query), [query]);
  const runnableActions = actions.filter((action) => !disabledActions.has(action.id));

  useEffect(() => {
    if (!open) {
      setQuery("");
      setSelected(0);
      return;
    }
    const id = requestAnimationFrame(() => inputRef.current?.focus());
    // Window-level Escape catches the keystroke even if focus is outside the
    // overlay (e.g. terminal still focused right after ⌘K opens it).
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

  useEffect(() => {
    setSelected(0);
  }, [query]);

  if (!open) return null;

  const runSelected = () => {
    const action = runnableActions[Math.min(selected, runnableActions.length - 1)];
    if (action) onRun(action);
  };

  return (
    <div
      className="palette-overlay"
      role="presentation"
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Escape") {
          e.preventDefault();
          onClose();
        } else if (e.key === "ArrowDown") {
          e.preventDefault();
          setSelected((idx) =>
            runnableActions.length ? (idx + 1) % runnableActions.length : 0
          );
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          setSelected((idx) =>
            runnableActions.length
              ? (idx - 1 + runnableActions.length) % runnableActions.length
              : 0
          );
        } else if (e.key === "Enter") {
          e.preventDefault();
          runSelected();
        }
      }}
    >
      <section
        className="palette-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="palette-title"
      >
        <div className="palette-head">
          <div>
            <div className="palette-kicker">
              <span className="kicker-dot" aria-hidden />
              COMMAND PALETTE
            </div>
            <h2 id="palette-title">Run a workflow action</h2>
          </div>
          <kbd className="palette-shortcut">⌘K</kbd>
        </div>

        <div className="palette-input-wrap">
          <span className="palette-input-icon" aria-hidden>
            <SearchIcon width={14} height={14} />
          </span>
          <input
            ref={inputRef}
            className="palette-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command…"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
          />
          {runnableActions.length > 0 && (
            <span className="palette-input-count">
              {runnableActions.length} action{runnableActions.length === 1 ? "" : "s"}
            </span>
          )}
        </div>

        <div className="palette-list" role="listbox">
          {actions.length === 0 && (
            <div className="palette-empty">No commands found</div>
          )}
          {actions.map((action) => {
            const disabled = disabledActions.has(action.id);
            const runnableIndex = runnableActions.findIndex(
              (candidate) => candidate.id === action.id
            );
            const active = !disabled && runnableIndex === selected;
            return (
              <button
                key={action.id}
                className={`palette-item ${active ? "active" : ""}`}
                disabled={disabled}
                onMouseEnter={() => {
                  if (!disabled) setSelected(runnableIndex);
                }}
                onClick={() => {
                  if (!disabled) onRun(action);
                }}
              >
                <span className="palette-item-title">{action.title}</span>
                <em className="palette-item-section">{action.section}</em>
              </button>
            );
          })}
        </div>

        <div className="palette-footer">
          <span>
            <kbd>↑↓</kbd> Navigate
          </span>
          <span>
            <kbd>↵</kbd> Run
          </span>
          <span>
            <kbd>Esc</kbd> Close
          </span>
        </div>
      </section>
    </div>
  );
}
