use crate::rules::{ResolvedRule, ResolvedRules, RuleMatcher, RuleSeverity, RuleSource};
use regex::Regex;
use serde::Serialize;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum GuardDecision {
    Safe,
    Allowed,
    Protected,
    Dangerous,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum GuardSeverity {
    None,
    Confirm,
    TypeToConfirm,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CommandGuardEvaluation {
    pub decision: GuardDecision,
    pub severity: GuardSeverity,
    pub matched_rule: Option<String>,
    pub matched_source: Option<RuleSource>,
    pub matched_pattern_type: Option<RuleMatcher>,
    pub command: String,
    pub cwd: String,
}

pub fn evaluate_command_guard(
    command: &str,
    cwd: &str,
    rules: &ResolvedRules,
) -> CommandGuardEvaluation {
    if let Some(rule) = first_match(command, &rules.allowed) {
        return matched_result(
            GuardDecision::Allowed,
            GuardSeverity::None,
            command,
            cwd,
            rule,
        );
    }

    if let Some(rule) = first_match(command, &rules.dangerous) {
        return matched_result(
            GuardDecision::Dangerous,
            severity_from_rule(rule),
            command,
            cwd,
            rule,
        );
    }

    if let Some(rule) = first_match(command, &rules.protected) {
        return matched_result(
            GuardDecision::Protected,
            severity_from_rule(rule),
            command,
            cwd,
            rule,
        );
    }

    CommandGuardEvaluation {
        decision: GuardDecision::Safe,
        severity: GuardSeverity::None,
        matched_rule: None,
        matched_source: None,
        matched_pattern_type: None,
        command: command.to_string(),
        cwd: cwd.to_string(),
    }
}

pub fn format_guard_log(pane_id: &str, result: &CommandGuardEvaluation) -> String {
    let mut line = format!(
        "command-guard pane={} decision={} severity={}",
        pane_id,
        decision_label(result.decision),
        severity_label(result.severity)
    );

    if let Some(rule) = &result.matched_rule {
        line.push_str(&format!(" matched_rule={}", sanitize_log_value(rule)));
    }
    if let Some(source) = result.matched_source {
        line.push_str(&format!(" matched_source={}", source_label(source)));
    }
    if let Some(pattern_type) = result.matched_pattern_type {
        line.push_str(&format!(
            " matched_pattern_type={}",
            pattern_type_label(pattern_type)
        ));
    }

    line.push_str(&format!(
        " cwd={} command={}",
        sanitize_log_value(&result.cwd),
        sanitize_log_value(&result.command)
    ));
    line
}

fn first_match<'a>(command: &str, rules: &'a [ResolvedRule]) -> Option<&'a ResolvedRule> {
    rules.iter().find(|rule| rule_matches(command, rule))
}

fn rule_matches(command: &str, rule: &ResolvedRule) -> bool {
    match rule.matcher {
        RuleMatcher::Substring => command.contains(&rule.pattern),
        RuleMatcher::Regex => Regex::new(&rule.pattern)
            .map(|regex| regex.is_match(command))
            .unwrap_or(false),
    }
}

fn matched_result(
    decision: GuardDecision,
    severity: GuardSeverity,
    command: &str,
    cwd: &str,
    rule: &ResolvedRule,
) -> CommandGuardEvaluation {
    CommandGuardEvaluation {
        decision,
        severity,
        matched_rule: Some(rule.pattern.clone()),
        matched_source: Some(rule.source),
        matched_pattern_type: Some(rule.matcher),
        command: command.to_string(),
        cwd: cwd.to_string(),
    }
}

fn severity_from_rule(rule: &ResolvedRule) -> GuardSeverity {
    match rule.severity {
        Some(RuleSeverity::Confirm) => GuardSeverity::Confirm,
        Some(RuleSeverity::TypeToConfirm) => GuardSeverity::TypeToConfirm,
        None => GuardSeverity::None,
    }
}

fn sanitize_log_value(value: &str) -> String {
    value.replace('\n', "\\n")
}

fn decision_label(decision: GuardDecision) -> &'static str {
    match decision {
        GuardDecision::Safe => "safe",
        GuardDecision::Allowed => "allowed",
        GuardDecision::Protected => "protected",
        GuardDecision::Dangerous => "dangerous",
    }
}

fn severity_label(severity: GuardSeverity) -> &'static str {
    match severity {
        GuardSeverity::None => "none",
        GuardSeverity::Confirm => "confirm",
        GuardSeverity::TypeToConfirm => "type-to-confirm",
    }
}

fn source_label(source: RuleSource) -> &'static str {
    match source {
        RuleSource::Project => "project",
        RuleSource::User => "user",
        RuleSource::Builtin => "builtin",
    }
}

fn pattern_type_label(pattern_type: RuleMatcher) -> &'static str {
    match pattern_type {
        RuleMatcher::Substring => "substring",
        RuleMatcher::Regex => "regex",
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::rules::{ResolvedText, RuleSeverity};

    #[test]
    fn safe_command_has_no_match() {
        let result = evaluate_command_guard("echo hello", "/workspace", &rules());

        assert_eq!(result.decision, GuardDecision::Safe);
        assert_eq!(result.severity, GuardSeverity::None);
        assert_eq!(result.matched_rule, None);
    }

    #[test]
    fn protected_substring_match_requires_confirm() {
        let result = evaluate_command_guard("git push origin main", "/workspace", &rules());

        assert_eq!(result.decision, GuardDecision::Protected);
        assert_eq!(result.severity, GuardSeverity::Confirm);
        assert_eq!(result.matched_rule.as_deref(), Some("git push"));
        assert_eq!(result.matched_source, Some(RuleSource::Project));
        assert_eq!(result.matched_pattern_type, Some(RuleMatcher::Substring));
    }

    #[test]
    fn dangerous_substring_match_requires_type_to_confirm() {
        let result = evaluate_command_guard("rm -rf ./fake-folder", "/workspace", &rules());

        assert_eq!(result.decision, GuardDecision::Dangerous);
        assert_eq!(result.severity, GuardSeverity::TypeToConfirm);
        assert_eq!(result.matched_rule.as_deref(), Some("rm -rf"));
    }

    #[test]
    fn allowed_suppresses_protected_match() {
        let result = evaluate_command_guard("git push origin feature/test", "/workspace", &rules());

        assert_eq!(result.decision, GuardDecision::Allowed);
        assert_eq!(result.severity, GuardSeverity::None);
        assert_eq!(
            result.matched_rule.as_deref(),
            Some("git push origin feature/test")
        );
    }

    #[test]
    fn allowed_suppresses_dangerous_match() {
        let result = evaluate_command_guard("rm -rf ./scratch", "/workspace", &rules());

        assert_eq!(result.decision, GuardDecision::Allowed);
        assert_eq!(result.severity, GuardSeverity::None);
        assert_eq!(result.matched_rule.as_deref(), Some("rm -rf ./scratch"));
    }

    #[test]
    fn regex_protected_match() {
        let result = evaluate_command_guard("kubectl delete pod api", "/workspace", &rules());

        assert_eq!(result.decision, GuardDecision::Protected);
        assert_eq!(result.severity, GuardSeverity::Confirm);
        assert_eq!(result.matched_rule.as_deref(), Some(r"kubectl\s+delete"));
        assert_eq!(result.matched_pattern_type, Some(RuleMatcher::Regex));
    }

    #[test]
    fn project_user_and_builtin_sources_are_preserved() {
        let rules = rules();

        let project = evaluate_command_guard("git push", "/workspace", &rules);
        let user = evaluate_command_guard("npm publish", "/workspace", &rules);
        let builtin = evaluate_command_guard("sudo whoami", "/workspace", &rules);

        assert_eq!(project.matched_source, Some(RuleSource::Project));
        assert_eq!(user.matched_source, Some(RuleSource::User));
        assert_eq!(builtin.matched_source, Some(RuleSource::Builtin));
    }

    #[test]
    fn dangerous_is_checked_before_protected_after_allowed() {
        let result = evaluate_command_guard("deploy prod now", "/workspace", &overlap_rules());

        assert_eq!(result.decision, GuardDecision::Dangerous);
        assert_eq!(result.severity, GuardSeverity::TypeToConfirm);
        assert_eq!(result.matched_rule.as_deref(), Some("deploy prod"));
    }

    #[test]
    fn invalid_regex_does_not_match_or_error() {
        let result = evaluate_command_guard(
            "kubectl delete pod api",
            "/workspace",
            &ResolvedRules {
                cwd: "/workspace".to_string(),
                project_file: None,
                global_file: None,
                protected: vec![rule(
                    "[",
                    RuleMatcher::Regex,
                    RuleSource::Project,
                    Some(RuleSeverity::Confirm),
                )],
                dangerous: Vec::new(),
                allowed: Vec::new(),
                ai_handoff: Vec::new(),
                project_context: Vec::new(),
            },
        );

        assert_eq!(result.decision, GuardDecision::Safe);
    }

    fn rules() -> ResolvedRules {
        ResolvedRules {
            cwd: "/workspace".to_string(),
            project_file: Some("/workspace/ANDSPACE.md".to_string()),
            global_file: Some("/home/me/.andspace/rules.md".to_string()),
            protected: vec![
                rule(
                    "git push",
                    RuleMatcher::Substring,
                    RuleSource::Project,
                    Some(RuleSeverity::Confirm),
                ),
                rule(
                    r"kubectl\s+delete",
                    RuleMatcher::Regex,
                    RuleSource::Project,
                    Some(RuleSeverity::Confirm),
                ),
                rule(
                    "npm publish",
                    RuleMatcher::Substring,
                    RuleSource::User,
                    Some(RuleSeverity::Confirm),
                ),
                rule(
                    "sudo",
                    RuleMatcher::Substring,
                    RuleSource::Builtin,
                    Some(RuleSeverity::Confirm),
                ),
            ],
            dangerous: vec![
                rule(
                    "rm -rf",
                    RuleMatcher::Substring,
                    RuleSource::Project,
                    Some(RuleSeverity::TypeToConfirm),
                ),
                rule(
                    "dropdb",
                    RuleMatcher::Substring,
                    RuleSource::Builtin,
                    Some(RuleSeverity::TypeToConfirm),
                ),
            ],
            allowed: vec![
                rule(
                    "git push origin feature/test",
                    RuleMatcher::Substring,
                    RuleSource::Project,
                    None,
                ),
                rule(
                    "rm -rf ./scratch",
                    RuleMatcher::Substring,
                    RuleSource::Project,
                    None,
                ),
            ],
            ai_handoff: vec![ResolvedText {
                value: "include cwd".to_string(),
                source: RuleSource::Project,
            }],
            project_context: Vec::new(),
        }
    }

    fn overlap_rules() -> ResolvedRules {
        ResolvedRules {
            cwd: "/workspace".to_string(),
            project_file: None,
            global_file: None,
            protected: vec![rule(
                "deploy",
                RuleMatcher::Substring,
                RuleSource::Project,
                Some(RuleSeverity::Confirm),
            )],
            dangerous: vec![rule(
                "deploy prod",
                RuleMatcher::Substring,
                RuleSource::Project,
                Some(RuleSeverity::TypeToConfirm),
            )],
            allowed: Vec::new(),
            ai_handoff: Vec::new(),
            project_context: Vec::new(),
        }
    }

    fn rule(
        pattern: &str,
        matcher: RuleMatcher,
        source: RuleSource,
        severity: Option<RuleSeverity>,
    ) -> ResolvedRule {
        ResolvedRule {
            pattern: pattern.to_string(),
            matcher,
            source,
            severity,
        }
    }
}
