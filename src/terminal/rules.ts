import { invoke } from "@tauri-apps/api/core";

export type RuleMatcher = "substring" | "regex";
export type RuleSeverity = "confirm" | "type-to-confirm";
export type RuleSource = "project" | "user" | "builtin";

export interface ResolvedRule {
  pattern: string;
  matcher: RuleMatcher;
  source: RuleSource;
  severity: RuleSeverity | null;
}

export interface ResolvedText {
  value: string;
  source: RuleSource;
}

export interface ResolvedRules {
  cwd: string;
  projectFile: string | null;
  globalFile: string | null;
  protected: ResolvedRule[];
  dangerous: ResolvedRule[];
  allowed: ResolvedRule[];
  aiHandoff: ResolvedText[];
  projectContext: ResolvedText[];
}

export type InitRulesStatus = "created" | "exists";

export interface InitRulesResult {
  result: InitRulesStatus;
  path: string;
}

export function loadRulesForCwd(cwd: string): Promise<ResolvedRules> {
  return invoke<ResolvedRules>("load_rules_for_cwd", { cwd });
}

export function initAndspaceRules(cwd: string): Promise<InitRulesResult> {
  return invoke<InitRulesResult>("init_andspace_rules", { cwd });
}
