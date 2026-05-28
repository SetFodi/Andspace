import { invoke } from "@tauri-apps/api/core";

export type ProjectTreeNodeKind = "directory" | "file";
export type PackageManager = "npm" | "pnpm" | "bun" | "yarn";

export interface ProjectTreeNode {
  name: string;
  path: string;
  kind: ProjectTreeNodeKind;
  children: ProjectTreeNode[];
  truncated: boolean;
}

export interface ProjectTree {
  root: ProjectTreeNode;
}

export interface PackageScript {
  name: string;
  command: string;
}

export interface PackageScripts {
  cwd: string;
  packageManager: PackageManager;
  scripts: PackageScript[];
}

export function loadProjectTree(cwd: string): Promise<ProjectTree> {
  return invoke<ProjectTree>("load_project_tree", { cwd });
}

export function expandProjectDirectory(path: string): Promise<ProjectTreeNode[]> {
  return invoke<ProjectTreeNode[]>("expand_project_directory", { path });
}

export function loadPackageScripts(cwd: string): Promise<PackageScripts> {
  return invoke<PackageScripts>("load_package_scripts", { cwd });
}

export function reportSidebarEvent(
  event: "sidebar-open" | "sidebar-close" | "script-run",
  options: {
    cwd?: string;
    name?: string;
    packageManager?: PackageManager;
  } = {}
): Promise<void> {
  return invoke("report_sidebar_event", {
    event,
    cwd: options.cwd ?? null,
    name: options.name ?? null,
    packageManager: options.packageManager ?? null,
  });
}

export function scriptRunCommand(
  packageManager: PackageManager,
  scriptName: string
): string {
  const name = shellQuoteWord(scriptName);
  if (packageManager === "npm") return `npm run ${name}`;
  if (packageManager === "bun") return `bun run ${name}`;
  if (packageManager === "yarn") return `yarn ${name}`;
  return `pnpm ${name}`;
}

export function shellQuote(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

function shellQuoteWord(value: string): string {
  return /^[A-Za-z0-9_:\-.]+$/.test(value) ? value : shellQuote(value);
}
