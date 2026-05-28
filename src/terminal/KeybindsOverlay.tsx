import { useEffect, useRef } from "react";

interface Bind {
  keys: string[];
  label: string;
}

interface Group {
  title: string;
  binds: Bind[];
}

const GROUPS: Group[] = [
  {
    title: "Tabs & Panes",
    binds: [
      { keys: ["⌘", "T"], label: "New tab" },
      { keys: ["⌘", "W"], label: "Close tab" },
      { keys: ["⌘", "["], label: "Previous tab" },
      { keys: ["⌘", "]"], label: "Next tab" },
      { keys: ["⌘", "1-9"], label: "Jump to tab" },
      { keys: ["⌘", "O"], label: "Split right" },
      { keys: ["⌘", "L"], label: "Split down" },
      { keys: ["⌘", "←/→/↑/↓"], label: "Focus pane" },
    ],
  },
  {
    title: "Sidebar & Files",
    binds: [
      { keys: ["⌘", "B"], label: "Toggle sidebar" },
      { keys: ["⌘", "0"], label: "Focus sidebar" },
      { keys: ["⌘", "←"], label: "Focus sidebar from leftmost pane" },
      { keys: ["⌘", "→"], label: "Return to pane" },
      { keys: ["↑", "↓"], label: "Navigate rows" },
      { keys: ["←", "→"], label: "Collapse / expand folder" },
      { keys: ["↵"], label: "Activate focused row" },
      { keys: ["⌘", "↵"], label: "Run default action" },
    ],
  },
  {
    title: "AI & Workflows",
    binds: [
      { keys: ["⌘", "K"], label: "Command palette" },
      { keys: ["⌘", "E"], label: "AI handoff" },
      { keys: ["⌘", "⇧", "I"], label: "Create ANDSPACE.md" },
    ],
  },
  {
    title: "General",
    binds: [
      { keys: ["Esc"], label: "Close modal / return to terminal" },
      { keys: ["⌘", "/"], label: "Show this cheatsheet" },
    ],
  },
];

interface Props {
  open: boolean;
  onClose: () => void;
}

export function KeybindsOverlay({ open, onClose }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);

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

  if (!open) return null;

  return (
    <div
      ref={rootRef}
      tabIndex={-1}
      className="keybinds-overlay"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        className="keybinds-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="keybinds-title"
      >
        <div className="keybinds-head">
          <div>
            <div className="keybinds-kicker">
              <span className="kicker-dot" aria-hidden />
              KEYBOARD SHORTCUTS
            </div>
            <h2 id="keybinds-title">AndSpace cheatsheet</h2>
          </div>
          <kbd className="keybinds-shortcut">⌘/</kbd>
        </div>

        <div className="keybinds-grid">
          {GROUPS.map((group) => (
            <div className="keybinds-group" key={group.title}>
              <div className="keybinds-group-title">{group.title}</div>
              <div className="keybinds-group-list">
                {group.binds.map((bind, idx) => (
                  <div className="keybinds-row" key={`${group.title}-${idx}`}>
                    <div className="keybinds-keys">
                      {bind.keys.map((k, i) => (
                        <kbd key={i} className="keybinds-key">
                          {k}
                        </kbd>
                      ))}
                    </div>
                    <span className="keybinds-label">{bind.label}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="keybinds-footer">
          <span>
            <kbd>Esc</kbd> Close
          </span>
          <span className="keybinds-foot-hint">
            Press <kbd>⌘/</kbd> any time to bring this back
          </span>
        </div>
      </section>
    </div>
  );
}
