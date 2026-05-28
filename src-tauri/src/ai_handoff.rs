use regex::{Captures, Regex};
use serde::{Deserialize, Serialize};

const DEFAULT_OUTPUT_LINES: usize = 80;
const MAX_OUTPUT_BYTES: usize = 32 * 1024;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HandoffPromptInput {
    pub cwd: String,
    pub command: Option<String>,
    pub exit_code: Option<i32>,
    pub output_lines: Vec<String>,
    pub project_context: Vec<String>,
    pub selected_text: Option<String>,
    pub redact: Option<bool>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HandoffPrompt {
    pub prompt: String,
    pub redaction_count: usize,
    pub output_line_count: usize,
}

pub fn build_handoff_prompt(input: HandoffPromptInput) -> HandoffPrompt {
    let command = input
        .command
        .as_deref()
        .filter(|value| !value.trim().is_empty())
        .unwrap_or("<no command captured>");
    let exit_code = input
        .exit_code
        .map(|code| code.to_string())
        .unwrap_or_else(|| "unknown".to_string());
    let output_lines = bound_output_lines(&input.output_lines);
    let output_line_count = output_lines.len();
    let output = if output_lines.is_empty() {
        "(No output captured.)".to_string()
    } else {
        output_lines.join("\n")
    };
    let project_context = if input.project_context.is_empty() {
        "(No Project Context in ANDSPACE.md.)".to_string()
    } else {
        input.project_context.join("\n")
    };

    let mut prompt = format!(
        "I ran this in {}:\n\n```sh\n$ {}\n```\n\nExit code: {}\n\nOutput (last {} lines):\n```text\n{}\n```\n\n",
        input.cwd,
        command,
        exit_code,
        output_line_count,
        output
    );

    if let Some(selected) = input
        .selected_text
        .as_deref()
        .filter(|value| !value.trim().is_empty())
    {
        prompt.push_str("Selected terminal text:\n```text\n");
        prompt.push_str(selected);
        prompt.push_str("\n```\n\n");
    }

    prompt.push_str("Project context:\n");
    prompt.push_str(&project_context);
    prompt.push_str(
        "\n\nRules:\n\n* Do not run git add, git commit, or git push unless I explicitly ask.\n* Suggest commands, but explain risky/destructive ones first.\n",
    );

    if input.redact.unwrap_or(true) {
        let (redacted, redaction_count) = redact_text(&prompt);
        HandoffPrompt {
            prompt: redacted,
            redaction_count,
            output_line_count,
        }
    } else {
        HandoffPrompt {
            prompt,
            redaction_count: 0,
            output_line_count,
        }
    }
}

pub fn redact_text(input: &str) -> (String, usize) {
    let mut value = input.to_string();
    let mut total = 0;

    let env_line = Regex::new(
        r#"(?im)^(\s*(?:export\s+)?[A-Z][A-Z0-9_]{2,}\s*=\s*)("[^"\r\n]*"|'[^'\r\n]*'|[^\s\r\n]+)\s*$"#,
    )
        .expect("valid env line redaction regex");
    value = replace_with_count(
        &env_line,
        &value,
        |caps| format!("{}[REDACTED]", &caps[1]),
        &mut total,
    );

    let env_secret = Regex::new(
        r#"(?i)\b([A-Z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD|PRIVATE|CREDENTIAL)[A-Z0-9_]*)\s*=\s*("[^"\r\n]*"|'[^'\r\n]*'|[^\s\r\n]+)"#,
    )
    .expect("valid env secret redaction regex");
    value = replace_with_count(
        &env_secret,
        &value,
        |caps| format!("{}=[REDACTED]", &caps[1]),
        &mut total,
    );

    let aws_key = Regex::new(r"\bAKIA[0-9A-Z]{16}\b").expect("valid aws key redaction regex");
    value = replace_with_count(
        &aws_key,
        &value,
        |_| "[REDACTED_AWS_ACCESS_KEY]".to_string(),
        &mut total,
    );

    let bearer =
        Regex::new(r"(?i)\bBearer\s+[A-Za-z0-9._~+/=-]+").expect("valid bearer redaction regex");
    value = replace_with_count(
        &bearer,
        &value,
        |_| "Bearer [REDACTED]".to_string(),
        &mut total,
    );

    (value, total)
}

fn replace_with_count(
    regex: &Regex,
    input: &str,
    replacement: impl Fn(&Captures<'_>) -> String,
    total: &mut usize,
) -> String {
    regex
        .replace_all(input, |caps: &Captures<'_>| {
            *total += 1;
            replacement(caps)
        })
        .to_string()
}

fn bound_output_lines(lines: &[String]) -> Vec<String> {
    let mut bounded: Vec<String> = lines
        .iter()
        .rev()
        .take(DEFAULT_OUTPUT_LINES)
        .cloned()
        .collect();
    bounded.reverse();

    while joined_len(&bounded) > MAX_OUTPUT_BYTES && !bounded.is_empty() {
        bounded.remove(0);
    }

    bounded
}

fn joined_len(lines: &[String]) -> usize {
    lines.iter().map(|line| line.len()).sum::<usize>() + lines.len().saturating_sub(1)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn truncates_output_to_last_eighty_lines() {
        let lines = (0..100).map(|i| format!("line-{i}")).collect();
        let result = build_handoff_prompt(input_with_output(lines));

        assert_eq!(result.output_line_count, 80);
        assert!(!result.prompt.contains("line-0"));
        assert!(result.prompt.contains("line-20"));
        assert!(result.prompt.contains("line-99"));
    }

    #[test]
    fn redacts_common_secret_shapes() {
        let result = build_handoff_prompt(input_with_output(vec![
            "API_KEY=abc123 Bearer test.token.value".to_string(),
            "AWS AKIA1234567890ABCDEF".to_string(),
            "PASSWORD=hunter2".to_string(),
        ]));

        assert!(result.redaction_count >= 4);
        assert!(!result.prompt.contains("abc123"));
        assert!(!result.prompt.contains("test.token.value"));
        assert!(!result.prompt.contains("AKIA1234567890ABCDEF"));
        assert!(!result.prompt.contains("hunter2"));
        assert!(result.prompt.contains("API_KEY=[REDACTED]"));
        assert!(result.prompt.contains("Bearer [REDACTED]"));
    }

    #[test]
    fn formats_prompt_with_command_cwd_exit_and_rules() {
        let result = build_handoff_prompt(HandoffPromptInput {
            cwd: "/repo".to_string(),
            command: Some("echo hello".to_string()),
            exit_code: Some(0),
            output_lines: vec!["hello".to_string()],
            project_context: vec!["Tauri terminal prototype.".to_string()],
            selected_text: None,
            redact: None,
        });

        assert!(result.prompt.contains("I ran this in /repo:"));
        assert!(result.prompt.contains("$ echo hello"));
        assert!(result.prompt.contains("Exit code: 0"));
        assert!(result.prompt.contains("hello"));
        assert!(result.prompt.contains("Tauri terminal prototype."));
        assert!(result
            .prompt
            .contains("Do not run git add, git commit, or git push"));
    }

    #[test]
    fn uses_no_output_fallback() {
        let result = build_handoff_prompt(input_with_output(vec![]));

        assert_eq!(result.output_line_count, 0);
        assert!(result.prompt.contains("(No output captured.)"));
    }

    #[test]
    fn includes_project_context_when_present() {
        let result = build_handoff_prompt(HandoffPromptInput {
            cwd: "/repo".to_string(),
            command: Some("false".to_string()),
            exit_code: Some(1),
            output_lines: vec![],
            project_context: vec!["Use pnpm for frontend commands.".to_string()],
            selected_text: Some("selected line".to_string()),
            redact: None,
        });

        assert!(result.prompt.contains("Use pnpm for frontend commands."));
        assert!(result.prompt.contains("Selected terminal text:"));
        assert!(result.prompt.contains("selected line"));
    }

    fn input_with_output(output_lines: Vec<String>) -> HandoffPromptInput {
        HandoffPromptInput {
            cwd: "/tmp/project".to_string(),
            command: Some("echo test".to_string()),
            exit_code: Some(0),
            output_lines,
            project_context: vec![],
            selected_text: None,
            redact: None,
        }
    }
}
