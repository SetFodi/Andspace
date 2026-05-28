import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
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
  onToast: (message: string, tone: "success" | "neutral" | "error") => void;
}

export function ProjectSidebar({
  open,
  cwd,
  focusedSection,
  onFocusedSectionChange,
  onRunScript,
  onToast,
}: Props) {
  const [tree, setTree] = useState<ProjectTree | null>(null);
  const [scripts, setScripts] = useState<PackageScripts | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const rootPath = cwd ?? "";

  useEffect(() => {
    if (!open || !cwd) return;
    let cancelled = false;
    setLoading(true);
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

  const scriptList = scripts?.scripts ?? [];
  const packageManagerLabel = scripts?.packageManager ?? "npm";

  return (
    <aside className={`project-sidebar ${open ? "open" : ""}`} aria-hidden={!open}>
      <div className="project-sidebar-inner">
        <div className="sidebar-head">
          <div>
            <div className="sidebar-kicker">Project</div>
            <h2 title={rootPath}>{shortPath(rootPath) || "No cwd yet"}</h2>
          </div>
          <button
            className="sidebar-refresh"
            disabled={!cwd || loading}
            title="Refresh"
            onClick={() => {
              if (!cwd) return;
              setTree(null);
              setScripts(null);
              void Promise.all([loadProjectTree(cwd), loadPackageScripts(cwd)]).then(
                ([nextTree, nextScripts]) => {
                  setTree(nextTree);
                  setScripts(nextScripts);
                  setExpanded(new Set([nextTree.root.path]));
                }
              );
            }}
          >
            ↻
          </button>
        </div>

        <SidebarSection
          id="files"
          title="Files"
          active={focusedSection === "files"}
          onFocus={() => onFocusedSectionChange("files")}
        >
          {loading && !tree && <div className="sidebar-muted">Loading files...</div>}
          {!loading && !tree && (
            <div className="sidebar-muted">Open a pane with a cwd to load files.</div>
          )}
          {tree && (
            <FileTree
              node={tree.root}
              expanded={expanded}
              depth={0}
              onToggle={(path) =>
                setExpanded((prev) => {
                  const next = new Set(prev);
                  if (next.has(path)) next.delete(path);
                  else next.add(path);
                  return next;
                })
              }
              onFileClick={(path) => {
                void navigator.clipboard.writeText(path);
                onToast("Copied file path", "neutral");
              }}
            />
          )}
        </SidebarSection>

        <SidebarSection
          id="scripts"
          title="Scripts"
          active={focusedSection === "scripts"}
          onFocus={() => onFocusedSectionChange("scripts")}
          meta={scriptList.length ? packageManagerLabel : undefined}
        >
          {loading && !scripts && <div className="sidebar-muted">Loading scripts...</div>}
          {scripts && scriptList.length === 0 && (
            <div className="sidebar-muted">No package scripts found.</div>
          )}
          {scripts &&
            scriptList.map((script) => (
              <button
                key={script.name}
                className="script-row"
                title={script.command}
                onClick={() => {
                  void reportSidebarEvent("script-run", {
                    cwd: scripts.cwd,
                    name: script.name,
                    packageManager: scripts.packageManager,
                  });
                  onRunScript(script, scripts);
                }}
              >
                <span>{script.name}</span>
                <code>{scriptRunCommand(scripts.packageManager, script.name)}</code>
              </button>
            ))}
        </SidebarSection>
      </div>
    </aside>
  );
}

function SidebarSection({
  id,
  title,
  active,
  meta,
  children,
  onFocus,
}: {
  id: string;
  title: string;
  active: boolean;
  meta?: string;
  children: ReactNode;
  onFocus: () => void;
}) {
  return (
    <section
      className={`sidebar-section ${active ? "active" : ""}`}
      aria-labelledby={`sidebar-${id}`}
      onFocus={onFocus}
    >
      <div className="sidebar-section-head">
        <h3 id={`sidebar-${id}`}>{title}</h3>
        {meta && <span>{meta}</span>}
      </div>
      {children}
    </section>
  );
}

function FileTree({
  node,
  expanded,
  depth,
  onToggle,
  onFileClick,
}: {
  node: ProjectTreeNode;
  expanded: Set<string>;
  depth: number;
  onToggle: (path: string) => void;
  onFileClick: (path: string) => void;
}) {
  const isDirectory = node.kind === "directory";
  const isExpanded = expanded.has(node.path);
  const children = useMemo(() => node.children ?? [], [node.children]);

  return (
    <div className="file-tree-node">
      <button
        className={`file-row ${isDirectory ? "directory" : "file"}`}
        style={{ paddingLeft: 8 + depth * 13 }}
        title={node.path}
        onClick={() => {
          if (isDirectory) onToggle(node.path);
          else onFileClick(node.path);
        }}
      >
        <span className="file-chevron">{isDirectory ? (isExpanded ? "▾" : "▸") : "·"}</span>
        <span className="file-name">{node.name}</span>
      </button>
      {isDirectory && isExpanded && (
        <div>
          {children.map((child) => (
            <FileTree
              key={child.path}
              node={child}
              expanded={expanded}
              depth={depth + 1}
              onToggle={onToggle}
              onFileClick={onFileClick}
            />
          ))}
          {node.truncated && (
            <div className="file-truncated" style={{ paddingLeft: 22 + depth * 13 }}>
              More hidden for performance
            </div>
          )}
        </div>
      )}
    </div>
  );
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
