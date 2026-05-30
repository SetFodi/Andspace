import { useEffect, useRef } from "react";
import { GITHUB_RELEASES_PAGE, type LatestRelease } from "./updateCheck";

export type UpdateCheckPrompt =
  | {
      kind: "available";
      currentTag: string;
      latest: LatestRelease;
    }
  | {
      kind: "error";
      message: string;
    };

interface Props {
  prompt: UpdateCheckPrompt | null;
  onOpenDownload: (url: string) => void;
  onViewReleaseNotes: (url: string) => void;
  onClose: () => void;
}

export function UpdateCheckOverlay({
  prompt,
  onOpenDownload,
  onViewReleaseNotes,
  onClose,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!prompt) return;
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
  }, [prompt, onClose]);

  if (!prompt) return null;

  const isAvailable = prompt.kind === "available";
  const releaseUrl = isAvailable ? prompt.latest.htmlUrl : GITHUB_RELEASES_PAGE;
  const title = isAvailable
    ? `AndSpace ${prompt.latest.tagName} is available`
    : "Couldn't check for updates";
  const body = isAvailable
    ? `You are currently running ${prompt.currentTag}. Download the latest alpha from GitHub when you are ready.`
    : prompt.message;

  return (
    <div
      ref={rootRef}
      tabIndex={-1}
      className="update-check-overlay"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        className="update-check-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="update-check-title"
      >
        <div className="update-check-kicker">
          <span className="kicker-dot" aria-hidden />
          UPDATE CHECK
        </div>
        <h2 id="update-check-title">{title}</h2>
        <p>{body}</p>
        <div className="update-check-actions">
          {isAvailable ? (
            <>
              <button
                type="button"
                className="update-check-button primary"
                onClick={() => onOpenDownload(releaseUrl)}
              >
                Open Download Page
              </button>
              <button
                type="button"
                className="update-check-button secondary"
                onClick={() => onViewReleaseNotes(releaseUrl)}
              >
                View Release Notes
              </button>
            </>
          ) : (
            <button
              type="button"
              className="update-check-button primary"
              onClick={() => onOpenDownload(GITHUB_RELEASES_PAGE)}
            >
              Open Releases Page
            </button>
          )}
          <button
            type="button"
            className="update-check-button ghost"
            onClick={onClose}
          >
            Dismiss
          </button>
        </div>
      </section>
    </div>
  );
}
