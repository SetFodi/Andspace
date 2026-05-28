import { invoke } from "@tauri-apps/api/core";
import type { ResolvedRules, RuleMatcher, RuleSource } from "./rules";

export type GuardDecision = "safe" | "allowed" | "protected" | "dangerous";
export type GuardSeverity = "none" | "confirm" | "type-to-confirm";

export interface CommandGuardEvaluation {
  decision: GuardDecision;
  severity: GuardSeverity;
  matchedRule: string | null;
  matchedSource: RuleSource | null;
  matchedPatternType: RuleMatcher | null;
  command: string;
  cwd: string;
}

export function evaluateCommandGuard(
  paneId: string,
  command: string,
  cwd: string,
  rules: ResolvedRules
): Promise<CommandGuardEvaluation> {
  return invoke<CommandGuardEvaluation>("evaluate_command_guard", {
    paneId,
    command,
    cwd,
    rules,
  });
}
