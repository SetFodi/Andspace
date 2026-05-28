import { useEffect, useMemo, useRef, useState } from "react";
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
    return () => cancelAnimationFrame(id);
  }, [open]);

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
            <div className="palette-kicker">Command Palette</div>
            <h2 id="palette-title">Run a workflow action</h2>
          </div>
          <span className="palette-shortcut">⌘K</span>
        </div>

        <input
          ref={inputRef}
          className="palette-input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Type a command..."
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
        />

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
                <span>{action.title}</span>
                <em>{action.section}</em>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
