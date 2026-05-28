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

interface Props {
  open: boolean;
  cwd: string | undefined;
  focusedSection: "files" | "scripts";
  onFocusedSectionChange: (section: "files" | "scripts") => void;
  onRunScript: (script: PackageScript, scripts: PackageScripts) => void;
  onFileAction: (path: string) => void;
  onFileDefault: (path: string) => void;
  onToast: (message: string, tone: "success" | "neutral" | "error") => void;
}

export interface ProjectSidebarHandle {
  focus(): void;
  getTree(): ProjectTree | null;
}

type SectionKey = "files" | "scripts";

export const ProjectSidebar = forwardRef<ProjectSidebarHandle, Props>(
  function ProjectSidebar(
    {
      open,
      cwd,
      focusedSection,
      onFocusedSectionChange,
      onRunScript,
      onFileAction,
      onFileDefault,
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

    const rootRef = useRef<HTMLElement | null>(null);

    const rootPath = cwd ?? "";

    // Remembers where the user last had keyboard focus so that arrow keys
    // stay coherent even if focus slips off (e.g. React re-renders, focus
    // briefly lands on body during a state change).
    const lastFocusedIndexRef = useRef(0);

    useImperativeHandle(
      ref,
      () => ({
        focus() {
          const root = rootRef.current;
          if (!root) return;
          // Prefer the first file row — drops the user straight into the
          // tree instead of the "Files" section header, so a single Down
          // press actually moves through files.
          const target =
            root.querySelector<HTMLElement>(".file-row") ??
            root.querySelector<HTMLElement>(
              ".sidebar-section-head, .script-row"
            );
          if (target) {
            target.focus();
            const items = sidebarFocusableItems(root);
            lastFocusedIndexRef.current = Math.max(items.indexOf(target), 0);
          }
        },
        getTree() {
          return tree;
        },
      }),
      [tree]
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
      ".sidebar-section-head, .file-row, .script-row, .file-load-more, .sidebar-foot-btn:not(:disabled)"
    )
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

export function scriptCommandForSidebar(script: PackageScript, scripts: PackageScripts) {
  return `cd ${shellQuote(scripts.cwd)} && ${scriptRunCommand(
    scripts.packageManager,
    script.name
  )}`;
}
