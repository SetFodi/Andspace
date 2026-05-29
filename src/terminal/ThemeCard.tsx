import type { ThemePreset } from "./preferencesModel";

export function ThemeCard({
  preset,
  selected,
  onClick,
}: {
  preset: ThemePreset;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`theme-card ${selected ? "selected" : ""}`}
      onClick={onClick}
    >
      <span
        className="theme-preview"
        style={{ background: preset.css.appBg }}
        aria-hidden
      >
        <span className="theme-preview-bar">
          <span className="theme-light" style={{ background: "#ff5f57" }} />
          <span className="theme-light" style={{ background: "#febc2e" }} />
          <span className="theme-light" style={{ background: "#28c840" }} />
        </span>
        <span
          className="theme-preview-panel"
          style={{ background: preset.css.surface }}
        >
          <span
            className="theme-line"
            style={{ background: preset.css.accent, width: "46%" }}
          />
          <span className="theme-line muted" style={{ width: "72%" }} />
          <span className="theme-line muted" style={{ width: "34%" }} />
        </span>
      </span>
      <span className="theme-card-meta">
        <span className="theme-card-title">
          <strong>{preset.title}</strong>
          <CheckMark />
        </span>
        <em>{preset.description}</em>
      </span>
    </button>
  );
}

export function CheckMark() {
  return (
    <svg className="check-mark" viewBox="0 0 16 16" aria-hidden>
      <path d="M3.5 8.4l3 3 6-7" />
    </svg>
  );
}
