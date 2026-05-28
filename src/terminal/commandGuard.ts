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

export interface GuardConfirmationRequest {
  requestId: string;
  paneId: string;
  command: string;
  cwd: string;
  decision: "protected" | "dangerous";
  severity: "confirm" | "type-to-confirm";
  matchedRule: string;
  matchedSource: RuleSource;
  matchedPatternType: RuleMatcher;
  requestedAt: number;
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

export function reportCommandGuardUiRequest(
  request: GuardConfirmationRequest
): Promise<void> {
  return invoke("report_command_guard_ui_request", {
    paneId: request.paneId,
    requestId: request.requestId,
    command: request.command,
    decision: request.decision,
    severity: request.severity,
    matchedRule: request.matchedRule,
    matchedSource: request.matchedSource,
  });
}

export function respondCommandGuard(
  request: GuardConfirmationRequest,
  action: "run" | "cancel"
): Promise<void> {
  return invoke("respond_command_guard", {
    paneId: request.paneId,
    requestId: request.requestId,
    command: request.command,
    decision: request.decision,
    action,
    matchedRule: request.matchedRule,
    matchedSource: request.matchedSource,
  });
}
