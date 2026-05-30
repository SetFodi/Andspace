import { invoke } from "@tauri-apps/api/core";

export interface PublicDiagnostics {
  andspaceVersion: string;
  osName: string;
  osVersion: string;
  architecture: string;
  preferencesPath: string;
  workspacePath: string;
  diagnosticsLogPath: string;
  installMethod: string;
}

export interface DiagnosticBlockInput {
  activeCwd?: string;
  renderer?: string;
  shellIntegration?: string;
}

export function getPublicDiagnostics(): Promise<PublicDiagnostics> {
  return invoke<PublicDiagnostics>("get_public_diagnostics");
}

export function buildDiagnosticBlock(
  base: PublicDiagnostics,
  input: DiagnosticBlockInput
): string {
  return [
    "AndSpace Diagnostics",
    "====================",
    `AndSpace version: ${value(base.andspaceVersion)}`,
    `macOS version: ${value(base.osVersion)}`,
    `Architecture: ${value(base.architecture)}`,
    `Renderer: ${value(input.renderer)}`,
    `Shell integration: ${value(input.shellIntegration)}`,
    `Active cwd: ${value(input.activeCwd)}`,
    `Preferences path: ${value(base.preferencesPath)}`,
    `Workspace path: ${value(base.workspacePath)}`,
    `Diagnostics log: ${value(base.diagnosticsLogPath)}`,
    `Install method: ${value(base.installMethod)}`,
    "",
    "Not included: terminal output, command history, AI prompts, secrets, Git diffs, or environment variable values.",
  ].join("\n");
}

function value(input: string | undefined | null): string {
  const trimmed = input?.trim();
  return trimmed ? trimmed : "unknown";
}
