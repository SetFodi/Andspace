import { useEffect, useMemo, useRef } from "react";
import { ClipboardIcon, ExternalLinkIcon, FileCodeIcon } from "./SidebarIcons";
import {
  gitStatusLabel,
  shortGitPath,
  type GitDiffPreview,
} from "./gitChanges";

interface Props {
  open: boolean;
  preview: GitDiffPreview | null;
  loading: boolean;
  error: string | null;
  onCopy: () => void;
  onOpenExternal: () => void;
  onClose: () => void;
}

export function GitDiffOverlay({
  open,
  preview,
  loading,
  error,
  onCopy,
  onOpenExternal,
  onClose,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const diffLines = useMemo(
    () => (preview?.diff ? preview.diff.split("\n") : []),
    [preview?.diff]
  );
  const canCopy = Boolean(preview?.diff && !preview.tooLarge);
  const title = preview ? shortGitPath(preview.path) : "Git diff";

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
      className="git-diff-overlay"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Escape") {
          e.preventDefault();
          onClose();
        }
      }}
    >
      <section
        className="git-diff-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="git-diff-title"
      >
        <div className="git-diff-head">
          <div>
            <div className="git-diff-kicker">
              <span className="kicker-dot" aria-hidden />
              GIT DIFF
            </div>
            <div className="git-diff-title-row">
              <span className="git-diff-title-icon" aria-hidden>
                <FileCodeIcon width={15} height={15} />
              </span>
              <h2 id="git-diff-title" title={preview?.path ?? title}>
                {title}
              </h2>
            </div>
            <div className="git-diff-meta">
              {preview?.branch && <span>{preview.branch}</span>}
              {preview && <span>{gitStatusLabel(preview.status)}</span>}
              {preview && <span>{formatBytes(preview.bytes)}</span>}
            </div>
          </div>
          <button
            type="button"
            className="git-diff-close"
            onClick={onClose}
            aria-label="Close Git diff"
          >
            Esc
          </button>
        </div>

        <div className="git-diff-body">
          {loading && <div className="git-diff-message">Loading diff…</div>}
          {!loading && error && (
            <div className="git-diff-message error">Could not load diff.</div>
          )}
          {!loading && !error && preview?.message && (
            <div className="git-diff-message">{preview.message}</div>
          )}
          {!loading &&
            !error &&
            preview &&
            !preview.message &&
            diffLines.length === 0 && (
              <div className="git-diff-message">No diff output for this file.</div>
            )}
          {!loading && !error && diffLines.length > 0 && (
            <pre className="git-diff-pre" aria-label="Read-only Git diff">
              <code>
                {diffLines.map((line, index) => (
                  <span
                    key={`${index}:${line.slice(0, 20)}`}
                    className={`git-diff-line ${classifyDiffLine(line)}`}
                  >
                    {line || " "}
                  </span>
                ))}
              </code>
            </pre>
          )}
        </div>

        <div className="git-diff-actions">
          <button
            type="button"
            className="git-diff-button secondary"
            disabled={!canCopy}
            onClick={onCopy}
          >
            <ClipboardIcon width={14} height={14} />
            Copy Diff
          </button>
          <button
            type="button"
            className="git-diff-button secondary"
            disabled={!preview}
            onClick={onOpenExternal}
          >
            <ExternalLinkIcon width={14} height={14} />
            Open externally
          </button>
          <button type="button" className="git-diff-button ghost" onClick={onClose}>
            Close
          </button>
        </div>
      </section>
    </div>
  );
}

function classifyDiffLine(line: string) {
  if (line.startsWith("@@")) return "hunk";
  if (line.startsWith("diff --git") || line.startsWith("index ")) return "meta";
  if (line.startsWith("+++") || line.startsWith("---")) return "file";
  if (line.startsWith("+")) return "addition";
  if (line.startsWith("-")) return "removal";
  return "context";
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KB`;
}
