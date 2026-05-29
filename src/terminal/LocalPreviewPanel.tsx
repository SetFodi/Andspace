import type { PointerEvent as ReactPointerEvent } from "react";
import { ExternalLinkIcon, RefreshIcon } from "./SidebarIcons";
import type { LocalPreviewTarget } from "./localPreview";

type PreviewTab = LocalPreviewTarget & {
  id: string;
  reloadKey: number;
};

interface Props {
  tabs: PreviewTab[];
  activeId: string | null;
  width: number;
  onResize: (width: number) => void;
  onSelect: (id: string) => void;
  onCloseTab: (id: string) => void;
  onRefresh: () => void;
  onOpenExternal: () => void;
  onClose: () => void;
}

export function LocalPreviewPanel({
  tabs,
  activeId,
  width,
  onResize,
  onSelect,
  onCloseTab,
  onRefresh,
  onOpenExternal,
  onClose,
}: Props) {
  if (tabs.length === 0) return null;

  const active = tabs.find((tab) => tab.id === activeId) ?? tabs[0];

  const startResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = width;
    const maxWidth = Math.min(820, Math.max(420, window.innerWidth - 420));

    const onMove = (moveEvent: PointerEvent) => {
      const next = clamp(startWidth + (startX - moveEvent.clientX), 380, maxWidth);
      onResize(next);
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  return (
    <aside
      className="local-preview-panel"
      aria-label="Local preview"
      style={{ width }}
    >
      <div
        className="local-preview-resizer"
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize local preview"
        onPointerDown={startResize}
      />
      <div className="local-preview-toolbar">
        <div className="local-preview-identity">
          <span className="local-preview-dot" aria-hidden />
          <div>
            <strong>{active.label}</strong>
            <span title={active.url}>{active.displayUrl}</span>
          </div>
        </div>
        <div className="local-preview-actions">
          <button
            type="button"
            className="local-preview-icon-btn"
            title="Refresh preview"
            aria-label="Refresh preview"
            onClick={onRefresh}
          >
            <RefreshIcon />
          </button>
          <button
            type="button"
            className="local-preview-icon-btn"
            title="Open in browser"
            aria-label="Open in browser"
            onClick={onOpenExternal}
          >
            <ExternalLinkIcon />
          </button>
          <button
            type="button"
            className="local-preview-close"
            title="Close preview"
            aria-label="Close preview"
            onClick={onClose}
          >
            <svg viewBox="0 0 16 16" aria-hidden>
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        </div>
      </div>

      <div className="local-preview-tabs" role="tablist" aria-label="Preview tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={tab.id === active.id}
            className={`local-preview-tab ${tab.id === active.id ? "active" : ""}`}
            title={tab.url}
            onClick={() => onSelect(tab.id)}
          >
            <span>{tab.label}</span>
            <em>{tab.displayUrl}</em>
            <span
              role="button"
              tabIndex={-1}
              className="local-preview-tab-close"
              aria-label={`Close ${tab.displayUrl}`}
              onClick={(event) => {
                event.stopPropagation();
                onCloseTab(tab.id);
              }}
            >
              ×
            </span>
          </button>
        ))}
      </div>

      <div className="local-preview-frame-wrap">
        <iframe
          key={`${active.url}:${active.reloadKey}`}
          className="local-preview-frame"
          title={`Local preview: ${active.displayUrl}`}
          src={active.url}
          allow="clipboard-read; clipboard-write"
        />
      </div>
    </aside>
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}
