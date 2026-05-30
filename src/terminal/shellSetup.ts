import { invoke } from "@tauri-apps/api/core";

export interface ShellToolStatus {
  id: string;
  title: string;
  package: string;
  description: string;
  installed: boolean;
}

export interface ShellSetupStatus {
  userShell: string;
  managedShell: string;
  homebrewPath: string | null;
  tools: ShellToolStatus[];
}

export function detectShellSetup(): Promise<ShellSetupStatus> {
  return invoke<ShellSetupStatus>("detect_shell_setup");
}

export function installRecommendedShellTools(): Promise<ShellSetupStatus> {
  return invoke<ShellSetupStatus>("install_recommended_shell_tools");
}

export function shortShellPath(path: string): string {
  const home = "/Users/";
  if (path.startsWith(home)) {
    const rest = path.slice(home.length);
    const slash = rest.indexOf("/");
    if (slash >= 0) return `~${rest.slice(slash)}`;
  }
  return path;
}
