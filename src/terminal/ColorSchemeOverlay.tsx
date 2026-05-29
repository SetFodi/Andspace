import { useEffect, useRef } from "react";
import {
  THEME_PRESETS,
  type ThemePreference,
} from "./preferencesModel";
import { ThemeCard } from "./ThemeCard";

interface Props {
  open: boolean;
  theme: ThemePreference;
  savingTheme: ThemePreference | null;
  onSelect: (theme: ThemePreference) => void;
  onClose: () => void;
}

export function ColorSchemeOverlay({
  open,
  theme,
  savingTheme,
  onSelect,
  onClose,
}: Props) {
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

  const selectedPreset =
    THEME_PRESETS.find((preset) => preset.value === theme) ?? THEME_PRESETS[0];

  return (
    <div
      ref={rootRef}
      tabIndex={-1}
      className="color-scheme-overlay"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        className="color-scheme-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="color-scheme-title"
        onKeyDown={(e) => e.stopPropagation()}
      >
        <div className="color-scheme-head">
          <div>
            <div className="preferences-kicker">
              <span className="kicker-dot" aria-hidden />
              COLOR SCHEME
            </div>
            <h2 id="color-scheme-title">Choose a color scheme</h2>
            <p>
              Changes apply immediately to app chrome and terminal panes. The
              current scheme is <strong>{selectedPreset.title}</strong>.
            </p>
          </div>
          <kbd className="color-scheme-shortcut">⌘P</kbd>
        </div>

        <div className="color-scheme-grid">
          {THEME_PRESETS.map((preset) => (
            <ThemeCard
              key={preset.value}
              preset={preset}
              selected={theme === preset.value}
              onClick={() => onSelect(preset.value)}
            />
          ))}
        </div>

        <div className="color-scheme-footer">
          <span>
            <kbd>Esc</kbd> Close
          </span>
          <span>
            {savingTheme
              ? `Saving ${themeLabel(savingTheme)}`
              : "Stored locally in Preferences"}
          </span>
        </div>
      </section>
    </div>
  );
}

function themeLabel(theme: ThemePreference): string {
  return THEME_PRESETS.find((preset) => preset.value === theme)?.title ?? theme;
}
