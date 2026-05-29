use regex::{Captures, Regex};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

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

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum AiCliTarget {
    Claude,
    Codex,
    Cursor,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AiCliTool {
    pub target: AiCliTarget,
    pub label: String,
    pub command: String,
    pub available: bool,
    pub path: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PreparedAiHandoff {
    pub target: AiCliTarget,
    pub prompt_path: String,
    pub shell_command: String,
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

pub fn detect_ai_cli_tools() -> Vec<AiCliTool> {
    tool_specs()
        .into_iter()
        .map(|(target, label, command)| {
            let path = crate::tool_resolver::resolve_executable(command);
            AiCliTool {
                target,
                label: label.to_string(),
                command: command.to_string(),
                available: path.is_some(),
                path: path.map(|path| path.display().to_string()),
            }
        })
        .collect()
}

pub fn prepare_ai_cli_handoff(
    target: AiCliTarget,
    prompt: &str,
    cwd: &str,
) -> Result<PreparedAiHandoff, String> {
    if prompt.trim().is_empty() {
        return Err("prompt is empty".to_string());
    }

    let path = handoff_prompt_path(target);
    std::fs::write(&path, prompt).map_err(|e| format!("write prompt file failed: {e}"))?;

    let command = command_for_target(target);
    let quoted_path = shell_quote(&path.display().to_string());
    let quoted_cwd = shell_quote(&resolve_handoff_cwd(cwd));
    let shell_command = match target {
        // Claude Code accepts stdin while keeping the TUI usable. Keep the
        // prompt body out of argv and only change cwd inside the subshell.
        AiCliTarget::Claude | AiCliTarget::Cursor => {
            format!("(cd {quoted_cwd} && {command} < {quoted_path}); rm -f {quoted_path}")
        }
        // Codex interactive mode requires stdin to be the terminal. Pass the
        // initial prompt as an argv value expanded from the temp file.
        AiCliTarget::Codex => {
            format!("(cd {quoted_cwd} && {command} \"$(cat {quoted_path})\"); rm -f {quoted_path}")
        }
    };

    Ok(PreparedAiHandoff {
        target,
        prompt_path: path.display().to_string(),
        shell_command,
    })
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
fn detect_ai_cli_tools_in_paths(paths: &[PathBuf]) -> Vec<AiCliTool> {
    tool_specs()
        .into_iter()
        .map(|(target, label, command)| {
            let path = crate::tool_resolver::find_executable_in_paths(paths, command);
            AiCliTool {
                target,
                label: label.to_string(),
                command: command.to_string(),
                available: path.is_some(),
                path: path.map(|path| path.display().to_string()),
            }
        })
        .collect()
}

fn tool_specs() -> Vec<(AiCliTarget, &'static str, &'static str)> {
    vec![
        (AiCliTarget::Claude, "Claude Code", "claude"),
        (AiCliTarget::Codex, "Codex", "codex"),
        (AiCliTarget::Cursor, "Cursor CLI", "cursor-agent"),
    ]
}

fn command_for_target(target: AiCliTarget) -> &'static str {
    match target {
        AiCliTarget::Claude => "claude",
        AiCliTarget::Codex => "codex",
        AiCliTarget::Cursor => "cursor-agent",
    }
}

fn handoff_prompt_path(target: AiCliTarget) -> PathBuf {
    let target = match target {
        AiCliTarget::Claude => "claude",
        AiCliTarget::Codex => "codex",
        AiCliTarget::Cursor => "cursor",
    };
    let nanos = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.as_nanos())
        .unwrap_or(0);
    std::env::temp_dir().join(format!(
        "andspace-handoff-{target}-{}-{nanos}.md",
        std::process::id()
    ))
}

fn shell_quote(value: &str) -> String {
    format!("'{}'", value.replace('\'', "'\\''"))
}

fn resolve_handoff_cwd(cwd: &str) -> String {
    let trimmed = cwd.trim();
    if !trimmed.is_empty() && Path::new(trimmed).is_dir() {
        return trimmed.to_string();
    }
    std::env::var("HOME").unwrap_or_else(|_| "/".to_string())
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

    #[test]
    fn detects_available_cli_tools_from_path() {
        let root = unique_temp_dir("cli-detect");
        std::fs::create_dir_all(&root).unwrap();
        make_executable(&root.join("claude"));
        make_executable(&root.join("cursor-agent"));

        let tools = detect_ai_cli_tools_in_paths(&[root.clone()]);
        let claude = tools
            .iter()
            .find(|tool| tool.target == AiCliTarget::Claude)
            .unwrap();
        let codex = tools
            .iter()
            .find(|tool| tool.target == AiCliTarget::Codex)
            .unwrap();
        let cursor = tools
            .iter()
            .find(|tool| tool.target == AiCliTarget::Cursor)
            .unwrap();

        assert!(claude.available);
        assert!(!codex.available);
        assert!(cursor.available);

        std::fs::remove_dir_all(&root).unwrap();
    }

    #[test]
    fn prepares_prompt_file_without_putting_prompt_in_shell_command() {
        let prompt = "secret prompt body";
        let cwd = unique_temp_dir("handoff-cwd");
        std::fs::create_dir_all(&cwd).unwrap();
        let prepared =
            prepare_ai_cli_handoff(AiCliTarget::Claude, prompt, cwd.to_str().unwrap()).unwrap();

        assert_eq!(
            std::fs::read_to_string(&prepared.prompt_path).unwrap(),
            prompt
        );
        assert!(prepared.shell_command.contains("cd "));
        assert!(prepared.shell_command.contains(" && claude < "));
        assert!(prepared.shell_command.contains("rm -f"));
        assert!(!prepared.shell_command.contains(prompt));

        std::fs::remove_file(prepared.prompt_path).unwrap();
        std::fs::remove_dir_all(cwd).unwrap();
    }

    #[test]
    fn prepares_codex_handoff_without_redirecting_stdin() {
        let prompt = "look at this project";
        let cwd = unique_temp_dir("codex-cwd");
        std::fs::create_dir_all(&cwd).unwrap();
        let prepared =
            prepare_ai_cli_handoff(AiCliTarget::Codex, prompt, cwd.to_str().unwrap()).unwrap();

        assert!(prepared.shell_command.contains("cd "));
        assert!(prepared.shell_command.contains(" && codex \"$(cat "));
        assert!(!prepared.shell_command.contains("codex < "));
        assert!(prepared.shell_command.contains("rm -f"));
        assert!(!prepared.shell_command.contains(prompt));

        std::fs::remove_file(prepared.prompt_path).unwrap();
        std::fs::remove_dir_all(cwd).unwrap();
    }

    #[test]
    fn handoff_cwd_falls_back_to_home_when_missing() {
        let prepared =
            prepare_ai_cli_handoff(AiCliTarget::Claude, "prompt", "/definitely/not/here").unwrap();
        let home = std::env::var("HOME").unwrap_or_else(|_| "/".to_string());

        assert!(prepared
            .shell_command
            .contains(&format!("cd {}", shell_quote(&home))));

        std::fs::remove_file(prepared.prompt_path).unwrap();
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

    fn unique_temp_dir(label: &str) -> PathBuf {
        let nanos = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        std::env::temp_dir().join(format!("andspace-handoff-{label}-{nanos}"))
    }

    fn make_executable(path: &Path) {
        std::fs::write(path, "#!/bin/sh\n").unwrap();
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let mut permissions = std::fs::metadata(path).unwrap().permissions();
            permissions.set_mode(0o755);
            std::fs::set_permissions(path, permissions).unwrap();
        }
    }
}
