import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import logoUrl from "../assets/logo.png";
import {
  ChevronIcon,
  FileCodeIcon,
  FileHiddenIcon,
  FileIcon,
  FileTextIcon,
  FolderClosedIcon,
  FolderOpenIcon,
  PlayIcon,
  RefreshIcon,
} from "./SidebarIcons";
import {
  expandProjectDirectory,
  loadPackageScripts,
  loadProjectTree,
  reportSidebarEvent,
  scriptRunCommand,
  shellQuote,
  type PackageScript,
  type PackageScripts,
  type ProjectTree,
  type ProjectTreeNode,
} from "./projectSidebarData";
import {
  absoluteGitPath,
  gitStatusLabel,
  loadGitStatus,
  reportGitEvent,
  shortGitPath,
  type GitChangedFile,
  type GitStatus,
} from "./gitChanges";
import { shortServerUrl } from "./serverDetection";
import {
  copyServerUrl,
  openServerUrl,
  useServerStore,
  type DetectedServer,
} from "./serverStore";

interface Props {
  open: boolean;
  cwd: string | undefined;
  gitRefreshKey: string;
  focusedSection: SectionKey;
  onFocusedSectionChange: (section: SectionKey) => void;
  onRunScript: (script: PackageScript, scripts: PackageScripts) => void;
  onFileAction: (path: string) => void;
  onFileDefault: (path: string) => void;
  onGitDiff: (file: GitChangedFile, status: GitStatus) => void;
  onToast: (message: string, tone: "success" | "neutral" | "error") => void;
}

export interface ProjectSidebarHandle {
  focus(): void;
  getTree(): ProjectTree | null;
  refreshGitChanges(): void;
  openFirstGitChangedFile(): string | null;
  openFirstGitDiff(): boolean;
}

type SectionKey = "files" | "scripts" | "servers" | "git";

export const ProjectSidebar = forwardRef<ProjectSidebarHandle, Props>(
  function ProjectSidebar(
    {
      open,
      cwd,
      gitRefreshKey,
      focusedSection,
      onFocusedSectionChange,
      onRunScript,
      onFileAction,
      onFileDefault,
      onGitDiff,
      onToast,
    },
    ref
  ) {
    const [tree, setTree] = useState<ProjectTree | null>(null);
    const [scripts, setScripts] = useState<PackageScripts | null>(null);
    const [loading, setLoading] = useState(false);
    const [expanded, setExpanded] = useState<Set<string>>(new Set());
    const [collapsed, setCollapsed] = useState<Set<SectionKey>>(new Set());
    const [activeScript, setActiveScript] = useState<string | null>(null);
    const [lazyChildren, setLazyChildren] = useState<
      Map<string, ProjectTreeNode[]>
    >(new Map());
    const [loadingPaths, setLoadingPaths] = useState<Set<string>>(new Set());
    const [gitStatus, setGitStatus] = useState<GitStatus | null>(null);
    const [gitLoading, setGitLoading] = useState(false);
    const [gitError, setGitError] = useState<string | null>(null);

    const rootRef = useRef<HTMLElement | null>(null);
    const gitRefreshTimerRef = useRef<number | null>(null);

    const rootPath = cwd ?? "";

    // Remembers where the user last had keyboard focus so that arrow keys
    // stay coherent even if focus slips off (e.g. React re-renders, focus
    // briefly lands on body during a state change).
    const lastFocusedIndexRef = useRef(0);

    const refreshGitChanges = useCallback(() => {
      if (!cwd) return;
      if (gitRefreshTimerRef.current !== null) {
        window.clearTimeout(gitRefreshTimerRef.current);
        gitRefreshTimerRef.current = null;
      }
      setGitLoading(true);
      setGitError(null);
      void reportGitEvent("git-refresh", { cwd });
      loadGitStatus(cwd)
        .then((status) => {
          setGitStatus(status);
        })
        .catch((e) => {
          setGitStatus(null);
          setGitError(String(e));
          void reportGitEvent("git-status-error", { cwd });
        })
        .finally(() => setGitLoading(false));
    }, [cwd]);

    const scheduleGitRefresh = useCallback(() => {
      if (!cwd) return;
      if (gitRefreshTimerRef.current !== null) {
        window.clearTimeout(gitRefreshTimerRef.current);
      }
      gitRefreshTimerRef.current = window.setTimeout(() => {
        gitRefreshTimerRef.current = null;
        refreshGitChanges();
      }, 220);
    }, [cwd, refreshGitChanges]);

    useImperativeHandle(
      ref,
      () => ({
        focus() {
          const root = rootRef.current;
          if (!root) return;
          const target = firstFocusableForSection(root, focusedSection);
          if (target) {
            target.focus();
            const items = sidebarFocusableItems(root);
            lastFocusedIndexRef.current = Math.max(items.indexOf(target), 0);
          }
        },
        getTree() {
          return tree;
        },
        refreshGitChanges() {
          refreshGitChanges();
        },
        openFirstGitChangedFile() {
          const file = gitStatus?.files[0];
          if (!file || !gitStatus?.repoRoot) return null;
          const path = absoluteGitPath(gitStatus.repoRoot, file.path);
          void reportGitEvent("git-file-open", { path });
          onFileAction(path);
          return path;
        },
        openFirstGitDiff() {
          const file = gitStatus?.files[0];
          if (!file || !gitStatus) return false;
          onGitDiff(file, gitStatus);
          return true;
        },
      }),
      [focusedSection, gitStatus, onFileAction, onGitDiff, refreshGitChanges, tree]
    );

    // If the user pressed ⌘+Left while the tree was still loading, the
    // initial focus landed on the "Files" section header (the only thing
    // focusable at that moment). Once the tree arrives, slide focus into
    // the first file row so arrow keys actually walk through files.
    useEffect(() => {
      if (!tree) return;
      const root = rootRef.current;
      if (!root) return;
      const active = document.activeElement as HTMLElement | null;
      if (!active || !root.contains(active)) return;
      if (!active.classList.contains("sidebar-section-head")) return;
      const firstFile = root.querySelector<HTMLElement>(".file-row");
      if (firstFile) {
        firstFile.focus();
        const items = sidebarFocusableItems(root);
        lastFocusedIndexRef.current = Math.max(items.indexOf(firstFile), 0);
      }
    }, [tree]);

    useEffect(() => {
      if (!open || !cwd) return;
      let cancelled = false;
      setLoading(true);
      setLazyChildren(new Map());
      setLoadingPaths(new Set());
      Promise.all([loadProjectTree(cwd), loadPackageScripts(cwd)])
        .then(([nextTree, nextScripts]) => {
          if (cancelled) return;
          setTree(nextTree);
          setScripts(nextScripts);
          setExpanded(new Set([nextTree.root.path]));
        })
        .catch((e) => {
          if (!cancelled) {
            onToast(`Could not load project sidebar: ${String(e)}`, "error");
          }
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }, [cwd, onToast, open]);

    useEffect(() => {
      if (!open || focusedSection !== "git") return;
      refreshGitChanges();
    }, [focusedSection, open, refreshGitChanges]);

    useEffect(() => {
      if (!open || !cwd || !gitRefreshKey) return;
      scheduleGitRefresh();
      return () => {
        if (gitRefreshTimerRef.current !== null) {
          window.clearTimeout(gitRefreshTimerRef.current);
          gitRefreshTimerRef.current = null;
        }
      };
    }, [cwd, gitRefreshKey, open, scheduleGitRefresh]);

    useEffect(() => {
      if (!open || !cwd) return;
      const onFocus = () => scheduleGitRefresh();
      window.addEventListener("focus", onFocus);
      return () => window.removeEventListener("focus", onFocus);
    }, [cwd, open, scheduleGitRefresh]);

    const expandTruncated = useCallback(
      (path: string) => {
        if (lazyChildren.has(path) || loadingPaths.has(path)) return;
        setLoadingPaths((prev) => {
          const next = new Set(prev);
          next.add(path);
          return next;
        });
        expandProjectDirectory(path)
          .then((nodes) => {
            setLazyChildren((prev) => {
              const next = new Map(prev);
              next.set(path, nodes);
              return next;
            });
          })
          .catch((e) => {
            onToast(`Could not expand directory: ${String(e)}`, "error");
          })
          .finally(() => {
            setLoadingPaths((prev) => {
              const next = new Set(prev);
              next.delete(path);
              return next;
            });
          });
      },
      [lazyChildren, loadingPaths, onToast]
    );

    const handleRefresh = () => {
      if (!cwd) return;
      setTree(null);
      setScripts(null);
      setLazyChildren(new Map());
      setLoadingPaths(new Set());
      void Promise.all([loadProjectTree(cwd), loadPackageScripts(cwd)]).then(
        ([nextTree, nextScripts]) => {
          setTree(nextTree);
          setScripts(nextScripts);
          setExpanded(new Set([nextTree.root.path]));
        }
      );
    };

    const toggleSection = (key: SectionKey) => {
      setCollapsed((prev) => {
        const next = new Set(prev);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        return next;
      });
    };

    const scriptList = scripts?.scripts ?? [];
    const packageManagerLabel = scripts?.packageManager ?? "npm";

    return (
      <aside
        ref={rootRef}
        className={`project-sidebar ${open ? "open" : ""}`}
        aria-hidden={!open}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            (e.currentTarget as HTMLElement).blur();
            // Hand focus back to the terminal — TerminalPane listens for this
            // and only the active pane responds.
            window.dispatchEvent(new CustomEvent("andspace:focus-terminal"));
            return;
          }

          const root = rootRef.current;
          if (!root) return;
          const focused = document.activeElement as HTMLElement | null;

          // Cmd+Left/Cmd+Right are app focus movement. Plain Left/Right still
          // owns directory collapse/expand below.
          if (
            e.metaKey &&
            !e.ctrlKey &&
            !e.altKey &&
            !e.shiftKey &&
            (e.key === "ArrowLeft" || e.key === "ArrowRight")
          ) {
            e.preventDefault();
            e.stopPropagation();
            if (e.key === "ArrowRight") {
              (e.currentTarget as HTMLElement).blur();
              window.dispatchEvent(new CustomEvent("andspace:focus-terminal"));
            }
            return;
          }

          // Cmd+Enter on a focused file row runs the default action (Cursor
          // > Code > nvim split > copy) without showing the actions menu.
          if (
            e.key === "Enter" &&
            e.metaKey &&
            focused?.classList.contains("file-row") &&
            focused.dataset.kind === "file"
          ) {
            const path = focused.dataset.path;
            if (path) {
              e.preventDefault();
              onFileDefault(path);
            }
            return;
          }

          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            const items = sidebarFocusableItems(root);
            if (items.length === 0) return;
            // Anchor: where focus currently is, OR the last place we put it
            // (so a brief slip to <body> during a re-render doesn't lose
            // the user's place in the list).
            let idx = focused ? items.indexOf(focused) : -1;
            if (idx === -1) {
              idx = Math.min(lastFocusedIndexRef.current, items.length - 1);
            }
            const delta = e.key === "ArrowDown" ? 1 : -1;
            const next = focusItemAt(items, idx + delta);
            if (next) {
              lastFocusedIndexRef.current = items.indexOf(next);
            }
            return;
          }

          if (e.key === "Home" || e.key === "End") {
            e.preventDefault();
            const items = sidebarFocusableItems(root);
            if (items.length === 0) return;
            const next = focusItemAt(
              items,
              e.key === "Home" ? 0 : items.length - 1
            );
            if (next) {
              lastFocusedIndexRef.current = items.indexOf(next);
            }
            return;
          }

          // Left/Right collapse/expand directory rows.
          if (
            (e.key === "ArrowLeft" || e.key === "ArrowRight") &&
            focused?.classList.contains("file-row") &&
            focused.dataset.kind === "directory"
          ) {
            const path = focused.dataset.path;
            if (!path) return;
            e.preventDefault();
            const isOpen = expanded.has(path);
            if (e.key === "ArrowRight" && !isOpen) {
              if (focused.dataset.truncated === "true" && !lazyChildren.has(path)) {
                expandTruncated(path);
              }
              setExpanded((prev) => {
                const next = new Set(prev);
                next.add(path);
                return next;
              });
            } else if (e.key === "ArrowLeft" && isOpen) {
              setExpanded((prev) => {
                const next = new Set(prev);
                next.delete(path);
                return next;
              });
            }
          }
        }}
      >
        <div className="project-sidebar-inner">
          <div className="sidebar-brand">
            <img
              className="sidebar-brand-mark"
              src={logoUrl}
              alt="AndSpace"
              draggable={false}
            />
            <div className="sidebar-brand-text">
              <div className="sidebar-brand-name">AndSpace</div>
              <div className="sidebar-brand-sub" title={rootPath}>
                {shortPath(rootPath) || "No cwd"}
              </div>
            </div>
          </div>

          <div className="sidebar-scroll">
            <SidebarSection
              id="files"
              title="Files"
              collapsed={collapsed.has("files")}
              active={focusedSection === "files"}
              onToggle={() => toggleSection("files")}
              onFocus={() => onFocusedSectionChange("files")}
            >
              {loading && !tree && (
                <div className="sidebar-muted">Loading files…</div>
              )}
              {!loading && !tree && (
                <div className="sidebar-muted">
                  Open a pane with a cwd to load files.
                </div>
              )}
              {tree && (
                <FileTree
                  node={tree.root}
                  expanded={expanded}
                  depth={0}
                  lazyChildren={lazyChildren}
                  loadingPaths={loadingPaths}
                  onToggle={(path, isTruncated) => {
                    if (isTruncated && !lazyChildren.has(path)) {
                      expandTruncated(path);
                    }
                    setExpanded((prev) => {
                      const next = new Set(prev);
                      if (next.has(path)) next.delete(path);
                      else next.add(path);
                      return next;
                    });
                  }}
                  onLoadMore={expandTruncated}
                  onFileClick={(path) => onFileAction(path)}
                />
              )}
            </SidebarSection>

            <SidebarSection
              id="scripts"
              title="Scripts"
              collapsed={collapsed.has("scripts")}
              active={focusedSection === "scripts"}
              meta={scriptList.length ? packageManagerLabel : undefined}
              onToggle={() => toggleSection("scripts")}
              onFocus={() => onFocusedSectionChange("scripts")}
            >
              {loading && !scripts && (
                <div className="sidebar-muted">Loading scripts…</div>
              )}
              {scripts && scriptList.length === 0 && (
                <div className="sidebar-muted">No package scripts found.</div>
              )}
              {scripts &&
                scriptList.map((script) => (
                  <button
                    key={script.name}
                    className={`script-row ${
                      activeScript === script.name ? "active" : ""
                    }`}
                    title={scriptRunCommand(scripts.packageManager, script.name)}
                    onClick={() => {
                      setActiveScript(script.name);
                      void reportSidebarEvent("script-run", {
                        cwd: scripts.cwd,
                        name: script.name,
                        packageManager: scripts.packageManager,
                      });
                      onRunScript(script, scripts);
                    }}
                  >
                    <span className="script-glyph" aria-hidden>
                      <PlayIcon width={10} height={10} />
                    </span>
                    <span className="script-name">{script.name}</span>
                  </button>
                ))}
            </SidebarSection>

            <ServersSection
              collapsed={collapsed.has("servers")}
              active={focusedSection === "servers"}
              onToggle={() => toggleSection("servers")}
              onFocus={() => onFocusedSectionChange("servers")}
              onToast={onToast}
            />

            <GitChangesSection
              status={gitStatus}
              loading={gitLoading}
              error={gitError}
              collapsed={collapsed.has("git")}
              active={focusedSection === "git"}
              onToggle={() => toggleSection("git")}
              onFocus={() => onFocusedSectionChange("git")}
              onRefresh={refreshGitChanges}
              onOpenFile={(path) => {
                void reportGitEvent("git-file-open", { path });
                onFileAction(path);
              }}
              onViewDiff={onGitDiff}
            />
          </div>

          <div className="sidebar-footer">
            <button
              className="sidebar-foot-btn"
              disabled={!cwd || loading}
              title="Refresh project"
              onClick={handleRefresh}
              aria-label="Refresh project"
            >
              <RefreshIcon />
            </button>
            <div className="sidebar-foot-spacer" />
            <div className="sidebar-foot-hint" title="Toggle sidebar">
              ⌘B
            </div>
          </div>
        </div>
      </aside>
    );
  }
);

function SidebarSection({
  id,
  title,
  collapsed,
  active,
  meta,
  children,
  onToggle,
  onFocus,
}: {
  id: string;
  title: string;
  collapsed: boolean;
  active: boolean;
  meta?: string;
  children: ReactNode;
  onToggle: () => void;
  onFocus: () => void;
}) {
  return (
    <section
      data-section={id}
      className={`sidebar-section ${active ? "active" : ""} ${
        collapsed ? "collapsed" : ""
      }`}
      aria-labelledby={`sidebar-${id}`}
      onFocus={onFocus}
    >
      <button
        type="button"
        className="sidebar-section-head"
        onClick={onToggle}
        aria-expanded={!collapsed}
      >
        <span className="sidebar-section-chevron" aria-hidden>
          <ChevronIcon open={!collapsed} width={10} height={10} />
        </span>
        <h3 id={`sidebar-${id}`}>{title}</h3>
        {meta && <span className="sidebar-section-meta">{meta}</span>}
      </button>
      {!collapsed && <div className="sidebar-section-body">{children}</div>}
    </section>
  );
}

function ServersSection({
  collapsed,
  active,
  onToggle,
  onFocus,
  onToast,
}: {
  collapsed: boolean;
  active: boolean;
  onToggle: () => void;
  onFocus: () => void;
  onToast: (message: string, tone: "success" | "neutral" | "error") => void;
}) {
  const servers = useServerStore((s) => s.servers);
  // Most-recent-first so users see what their latest `pnpm dev` printed
  // at the top, even if older URLs are still around.
  const sorted = useMemo(
    () => [...servers].sort((a, b) => b.lastSeenAt - a.lastSeenAt),
    [servers]
  );
  const meta = sorted.length > 0 ? String(sorted.length) : undefined;

  return (
    <SidebarSection
      id="servers"
      title="Servers"
      collapsed={collapsed}
      active={active}
      meta={meta}
      onToggle={onToggle}
      onFocus={onFocus}
    >
      {sorted.length === 0 && (
        <div className="sidebar-muted servers-empty">
          No local servers yet. Run a dev server and its URL will appear here.
        </div>
      )}
      {sorted.map((server) => (
        <ServerRow
          key={server.url}
          server={server}
          onOpen={() => {
            void openServerUrl(server.url).catch((e) =>
              onToast(`Could not open URL: ${String(e)}`, "error")
            );
          }}
          onCopy={() => {
            void copyServerUrl(server.url).then(
              () => onToast("Copied server URL", "neutral"),
              (e) => onToast(`Could not copy URL: ${String(e)}`, "error")
            );
          }}
        />
      ))}
    </SidebarSection>
  );
}

function ServerRow({
  server,
  onOpen,
  onCopy,
}: {
  server: DetectedServer;
  onOpen: () => void;
  onCopy: () => void;
}) {
  return (
    <button
      className="server-row"
      data-url={server.url}
      title={`${server.url} — Click to open · ⌘C to copy`}
      onClick={onOpen}
      onContextMenu={(e) => {
        e.preventDefault();
        onCopy();
      }}
      onKeyDown={(e) => {
        // Cmd+C / Ctrl+C while the row is focused copies the URL without
        // opening it — matches how the keybinds cheatsheet advertises it.
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "c") {
          e.preventDefault();
          onCopy();
        }
      }}
    >
      <span className="server-status" aria-hidden />
      <span className="server-label">{server.label}</span>
      <span className="server-url">{shortServerUrl(server.url)}</span>
    </button>
  );
}

function GitChangesSection({
  status,
  loading,
  error,
  collapsed,
  active,
  onToggle,
  onFocus,
  onRefresh,
  onOpenFile,
  onViewDiff,
}: {
  status: GitStatus | null;
  loading: boolean;
  error: string | null;
  collapsed: boolean;
  active: boolean;
  onToggle: () => void;
  onFocus: () => void;
  onRefresh: () => void;
  onOpenFile: (path: string) => void;
  onViewDiff: (file: GitChangedFile, status: GitStatus) => void;
}) {
  const files = status?.files ?? [];
  const meta =
    status?.isRepo && files.length > 0
      ? String(files.length)
      : status?.isRepo
        ? "clean"
        : undefined;
  const repoName = status?.repoRoot ? basename(status.repoRoot) : null;

  return (
    <SidebarSection
      id="git"
      title="Git Changes"
      collapsed={collapsed}
      active={active}
      meta={meta}
      onToggle={onToggle}
      onFocus={onFocus}
    >
      <div className="git-summary">
        <div className="git-identity">
          <div className="git-repo" title={status?.repoRoot ?? ""}>
            {status?.isRepo ? (repoName ?? "Repository") : "No Git repo"}
          </div>
          {status?.isRepo && (
            <div className="git-branch" title={status.branch ?? ""}>
              {status.branch ?? "detached"}
            </div>
          )}
        </div>
        <button
          type="button"
          className="git-refresh"
          disabled={loading}
          onClick={onRefresh}
          title="Refresh Git Changes"
          aria-label="Refresh Git Changes"
        >
          <RefreshIcon width={13} height={13} />
        </button>
      </div>
      {loading && <div className="sidebar-muted">Loading Git changes…</div>}
      {!loading && error && (
        <div className="sidebar-muted">Could not load Git status.</div>
      )}
      {!loading && !error && status && !status.isRepo && (
        <div className="sidebar-muted git-empty">No Git repository found.</div>
      )}
      {!loading && !error && status?.isRepo && files.length === 0 && (
        <div className="sidebar-muted git-empty">Working tree clean.</div>
      )}
      {!loading &&
        !error &&
        status?.isRepo &&
        files.map((file) => (
          <GitChangedFileRow
            key={`${file.rawStatus}:${file.path}:${file.oldPath ?? ""}`}
            file={file}
            repoRoot={status.repoRoot ?? ""}
            onOpenFile={onOpenFile}
            onViewDiff={() => onViewDiff(file, status)}
          />
        ))}
    </SidebarSection>
  );
}

function GitChangedFileRow({
  file,
  repoRoot,
  onOpenFile,
  onViewDiff,
}: {
  file: GitChangedFile;
  repoRoot: string;
  onOpenFile: (path: string) => void;
  onViewDiff: () => void;
}) {
  const path = absoluteGitPath(repoRoot, file.path);
  const label = gitStatusLabel(file.status);

  return (
    <button
      type="button"
      className={`git-row ${file.status}`}
      title={
        file.oldPath
          ? `${file.oldPath} → ${file.path} — Click to view diff · ⌘↵ or right-click for file actions`
          : `${file.path} — Click to view diff · ⌘↵ or right-click for file actions`
      }
      data-path={path}
      onClick={onViewDiff}
      onContextMenu={(e) => {
        e.preventDefault();
        onOpenFile(path);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" && e.metaKey) {
          e.preventDefault();
          onOpenFile(path);
        }
      }}
    >
      <span className="git-status-chip">{label}</span>
      <span className="git-path">{shortGitPath(file.path)}</span>
    </button>
  );
}

function FileTree({
  node,
  expanded,
  depth,
  lazyChildren,
  loadingPaths,
  onToggle,
  onLoadMore,
  onFileClick,
}: {
  node: ProjectTreeNode;
  expanded: Set<string>;
  depth: number;
  lazyChildren: Map<string, ProjectTreeNode[]>;
  loadingPaths: Set<string>;
  onToggle: (path: string, isTruncated: boolean) => void;
  onLoadMore: (path: string) => void;
  onFileClick: (path: string) => void;
}) {
  const isDirectory = node.kind === "directory";
  const isExpanded = expanded.has(node.path);
  const overriddenChildren = lazyChildren.get(node.path);
  const effectiveChildren = useMemo(
    () => overriddenChildren ?? node.children ?? [],
    [node.children, overriddenChildren]
  );
  const stillTruncated = node.truncated && !overriddenChildren;
  const isLoading = loadingPaths.has(node.path);

  return (
    <div className="file-tree-node">
      <button
        className={`file-row ${isDirectory ? "directory" : "file"} ${
          isDirectory && isExpanded ? "open" : ""
        }`}
        style={{ paddingLeft: 6 + depth * 12 }}
        title={node.path}
        data-path={node.path}
        data-kind={isDirectory ? "directory" : "file"}
        data-truncated={node.truncated ? "true" : "false"}
        onClick={() => {
          if (isDirectory) onToggle(node.path, node.truncated);
          else onFileClick(node.path);
        }}
      >
        <span className="file-chevron" aria-hidden>
          {isDirectory ? (
            <ChevronIcon open={isExpanded} width={9} height={9} />
          ) : null}
        </span>
        <span className="file-glyph" aria-hidden>
          {isDirectory ? (
            isExpanded ? (
              <FolderOpenIcon />
            ) : (
              <FolderClosedIcon />
            )
          ) : (
            fileIconFor(node.name)
          )}
        </span>
        <span className="file-name">{node.name}</span>
      </button>
      {isDirectory && isExpanded && (
        <div className="file-tree-children">
          {effectiveChildren.map((child) => (
            <FileTree
              key={child.path}
              node={child}
              expanded={expanded}
              depth={depth + 1}
              lazyChildren={lazyChildren}
              loadingPaths={loadingPaths}
              onToggle={onToggle}
              onLoadMore={onLoadMore}
              onFileClick={onFileClick}
            />
          ))}
          {isLoading && (
            <div
              className="file-truncated"
              style={{ paddingLeft: 22 + depth * 12 }}
            >
              Loading…
            </div>
          )}
          {!isLoading && stillTruncated && (
            <button
              type="button"
              className="file-load-more"
              style={{ paddingLeft: 22 + depth * 12 }}
              onClick={() => onLoadMore(node.path)}
            >
              Show all items in this folder
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function sidebarFocusableItems(root: HTMLElement): HTMLElement[] {
  return Array.from(
    root.querySelectorAll<HTMLElement>(
      ".sidebar-section-head, .file-row, .script-row, .server-row, .git-row, .git-refresh:not(:disabled), .file-load-more, .sidebar-foot-btn:not(:disabled)"
    )
  );
}

function firstFocusableForSection(
  root: HTMLElement,
  section: SectionKey
): HTMLElement | null {
  const sectionRoot = root.querySelector<HTMLElement>(
    `.sidebar-section[data-section="${section}"]`
  );
  if (!sectionRoot) return null;

  if (section === "files") {
    return (
      sectionRoot.querySelector<HTMLElement>(".file-row") ??
      sectionRoot.querySelector<HTMLElement>(".sidebar-section-head")
    );
  }
  if (section === "scripts") {
    return (
      sectionRoot.querySelector<HTMLElement>(".script-row") ??
      sectionRoot.querySelector<HTMLElement>(".sidebar-section-head")
    );
  }
  if (section === "servers") {
    return (
      sectionRoot.querySelector<HTMLElement>(".server-row") ??
      sectionRoot.querySelector<HTMLElement>(".sidebar-section-head")
    );
  }
  return (
    sectionRoot.querySelector<HTMLElement>(".git-row") ??
    sectionRoot.querySelector<HTMLElement>(".git-refresh:not(:disabled)") ??
    sectionRoot.querySelector<HTMLElement>(".sidebar-section-head")
  );
}

function focusItemAt(items: HTMLElement[], index: number): HTMLElement | null {
  if (items.length === 0) return null;
  const wrapped = ((index % items.length) + items.length) % items.length;
  const target = items[wrapped];
  target.focus();
  target.scrollIntoView({ block: "nearest", inline: "nearest" });
  return target;
}

function fileIconFor(name: string) {
  if (name.startsWith(".")) return <FileHiddenIcon />;
  if (/\.(md|mdx|txt|rst|log)$/i.test(name)) return <FileTextIcon />;
  if (
    /\.(ts|tsx|js|jsx|mjs|cjs|json|jsonc|toml|yaml|yml|rs|go|py|sh|html|css|scss)$/i.test(
      name
    )
  )
    return <FileCodeIcon />;
  return <FileIcon />;
}

function shortPath(path: string): string {
  if (!path) return "";
  return path.replace(/^\/Users\/[^/]+/, "~");
}

function basename(path: string): string {
  return path.replace(/\/$/, "").split("/").pop() ?? path;
}

export function scriptCommandForSidebar(script: PackageScript, scripts: PackageScripts) {
  return `cd ${shellQuote(scripts.cwd)} && ${scriptRunCommand(
    scripts.packageManager,
    script.name
  )}`;
}
