import { useEffect, useMemo, useRef, useState } from "react";
import { SearchIcon } from "./SidebarIcons";
import {
  filterPickerEntries,
  flattenTreeFiles,
  reportFileActionEvent,
  type PickerEntry,
} from "./fileActions";
import type { ProjectTree } from "./projectSidebarData";

interface Props {
  open: boolean;
  tree: ProjectTree | null;
  loading: boolean;
  cwd: string | null;
  onClose: () => void;
  onSelect: (entry: PickerEntry, useDefault: boolean) => void;
}

export function GoToFileOverlay({
  open,
  tree,
  loading,
  cwd,
  onClose,
  onSelect,
}: Props) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const entries = useMemo(() => flattenTreeFiles(tree), [tree]);
  const filtered = useMemo(
    () => filterPickerEntries(entries, query),
    [entries, query]
  );

  useEffect(() => {
    if (!open) {
      setQuery("");
      setSelected(0);
      return;
    }
    if (cwd) {
      void reportFileActionEvent("file-picker-open", { path: cwd });
    }
    const id = requestAnimationFrame(() => inputRef.current?.focus());
    // Window-level Escape so it works even if focus slips outside the input.
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
  }, [open, cwd, onClose]);

  useEffect(() => {
    setSelected(0);
  }, [query]);

  if (!open) return null;

  const activate = (entry: PickerEntry, useDefault: boolean) => {
    void reportFileActionEvent("file-picker-select", { path: entry.path });
    onSelect(entry, useDefault);
  };

  return (
    <div
      className="picker-overlay"
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
          setSelected((idx) =>
            filtered.length ? (idx + 1) % filtered.length : 0
          );
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          setSelected((idx) =>
            filtered.length
              ? (idx - 1 + filtered.length) % filtered.length
              : 0
          );
        } else if (e.key === "Enter") {
          e.preventDefault();
          const entry = filtered[Math.min(selected, filtered.length - 1)];
          if (entry) activate(entry, e.metaKey);
        }
      }}
    >
      <section
        className="picker-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="picker-title"
      >
        <div className="picker-head">
          <div>
            <div className="picker-kicker">
              <span className="kicker-dot" aria-hidden />
              GO TO FILE
            </div>
            <h2 id="picker-title">Project files</h2>
          </div>
          <kbd className="picker-shortcut">⌘K</kbd>
        </div>

        <div className="picker-input-wrap">
          <span className="picker-input-icon" aria-hidden>
            <SearchIcon width={14} height={14} />
          </span>
          <input
            ref={inputRef}
            className="picker-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              loading
                ? "Loading project files…"
                : entries.length === 0
                ? "No files in the loaded tree"
                : "Type a filename…"
            }
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
          />
          {filtered.length > 0 && (
            <span className="picker-input-count">
              {filtered.length} result{filtered.length === 1 ? "" : "s"}
            </span>
          )}
        </div>

        <div className="picker-list" role="listbox">
          {filtered.length === 0 && !loading && (
            <div className="picker-empty">
              {entries.length === 0
                ? "Sidebar tree hasn't loaded yet. Open the sidebar (⌘B) or wait a moment."
                : "No matches"}
            </div>
          )}
          {filtered.map((entry, idx) => {
            const active = idx === selected;
            return (
              <button
                key={entry.path}
                className={`picker-item ${active ? "active" : ""}`}
                onMouseEnter={() => setSelected(idx)}
                onClick={(ev) => activate(entry, ev.metaKey)}
                title={entry.path}
              >
                <span className="picker-item-name">{entry.name}</span>
                <em className="picker-item-parent">{shorten(entry.parent)}</em>
              </button>
            );
          })}
        </div>

        <div className="picker-footer">
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

function shorten(p: string): string {
  return p.replace(/^\/Users\/[^/]+/, "~");
}
