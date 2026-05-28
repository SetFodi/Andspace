use crate::pty::PtyManager;
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, State};

#[tauri::command]
pub fn create_pty(
    app: AppHandle,
    state: State<'_, PtyManager>,
    cols: u16,
    rows: u16,
) -> Result<String, String> {
    state.create(app, cols, rows)
}

#[tauri::command]
pub fn write_to_pty(
    state: State<'_, PtyManager>,
    pane_id: String,
    data: String,
) -> Result<(), String> {
    state.write(&pane_id, &data)
}

#[tauri::command]
pub fn resize_pty(
    state: State<'_, PtyManager>,
    pane_id: String,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    state.resize(&pane_id, cols, rows)
}

#[tauri::command]
pub fn kill_pty(state: State<'_, PtyManager>, pane_id: String) -> Result<(), String> {
    state.kill(&pane_id)
}

#[tauri::command]
pub fn report_renderer(kind: String) {
    crate::pty::diag_log(&format!("renderer={kind}"));
}

#[tauri::command]
pub fn report_shell_event(pane_id: String, line: String) {
    crate::pty::diag_log(&format!("shell pane={pane_id} {line}"));
}

#[tauri::command]
pub fn load_rules_for_cwd(cwd: String) -> Result<crate::rules::ResolvedRules, String> {
    crate::rules::load_rules_for_cwd(&cwd)
}

#[tauri::command]
pub fn init_andspace_rules(cwd: String) -> Result<crate::rules::InitRulesResult, String> {
    crate::rules::init_andspace_rules(&cwd)
}

#[tauri::command]
pub fn build_ai_handoff_prompt(
    input: crate::ai_handoff::HandoffPromptInput,
) -> Result<crate::ai_handoff::HandoffPrompt, String> {
    Ok(crate::ai_handoff::build_handoff_prompt(input))
}

#[tauri::command]
pub fn detect_ai_cli_tools() -> Result<Vec<crate::ai_handoff::AiCliTool>, String> {
    Ok(crate::ai_handoff::detect_ai_cli_tools())
}

#[tauri::command]
pub fn prepare_ai_cli_handoff(
    target: crate::ai_handoff::AiCliTarget,
    prompt: String,
) -> Result<crate::ai_handoff::PreparedAiHandoff, String> {
    crate::ai_handoff::prepare_ai_cli_handoff(target, &prompt)
}

#[tauri::command]
pub fn report_ai_handoff_event(
    event: String,
    pane_id: String,
    command: Option<String>,
    exit_code: Option<i32>,
    output_line_count: usize,
    redaction_count: usize,
    target: Option<String>,
    error: Option<String>,
) {
    let event = if matches!(
        event.as_str(),
        "handoff-open"
            | "handoff-copy"
            | "handoff-preview"
            | "handoff-send"
            | "handoff-send-error"
            | "handoff-send-success"
    ) {
        event
    } else {
        "handoff-unknown".to_string()
    };
    let command = command.unwrap_or_default();
    let exit_code = exit_code
        .map(|code| code.to_string())
        .unwrap_or_else(|| "unknown".to_string());
    let mut line = format!(
        "{event} pane={pane_id} command={} exit_code={exit_code} output_line_count={output_line_count} redaction_count={redaction_count}",
        log_value(&command)
    );
    if let Some(target) = target {
        line.push_str(&format!(" target={}", log_value(&target)));
    }
    if let Some(error) = error {
        line.push_str(&format!(" error={}", log_value(&error)));
    }
    crate::pty::diag_log(&line);
}

#[tauri::command]
pub fn report_command_palette_event(action: Option<String>) {
    match action {
        Some(action) => crate::pty::diag_log(&format!(
            "command-palette-run action={}",
            log_value(&action)
        )),
        None => crate::pty::diag_log("command-palette-open"),
    }
}

#[tauri::command]
pub fn load_project_tree(cwd: String) -> Result<crate::project_sidebar::ProjectTree, String> {
    let result = crate::project_sidebar::load_project_tree(&cwd);
    if result.is_ok() {
        crate::pty::diag_log(&format!("project-tree-load cwd={}", log_value(&cwd)));
    }
    result
}

#[tauri::command]
pub fn load_package_scripts(cwd: String) -> Result<crate::project_sidebar::PackageScripts, String> {
    let result = crate::project_sidebar::load_package_scripts(&cwd);
    if result.is_ok() {
        crate::pty::diag_log(&format!("package-scripts-load cwd={}", log_value(&cwd)));
    }
    result
}

#[tauri::command]
pub fn report_sidebar_event(
    event: String,
    cwd: Option<String>,
    name: Option<String>,
    package_manager: Option<String>,
) {
    match event.as_str() {
        "sidebar-open" | "sidebar-close" => crate::pty::diag_log(&event),
        "script-run" => crate::pty::diag_log(&format!(
            "script-run name={} package_manager={}{}",
            log_value(name.as_deref().unwrap_or("")),
            log_value(package_manager.as_deref().unwrap_or("")),
            cwd.map(|cwd| format!(" cwd={}", log_value(&cwd)))
                .unwrap_or_default()
        )),
        _ => crate::pty::diag_log(&format!("sidebar-unknown event={}", log_value(&event))),
    }
}

#[tauri::command]
pub fn evaluate_command_guard(
    pane_id: String,
    command: String,
    cwd: String,
    rules: crate::rules::ResolvedRules,
) -> Result<crate::command_guard::CommandGuardEvaluation, String> {
    let result = crate::command_guard::evaluate_command_guard(&command, &cwd, &rules);
    crate::pty::diag_log(&crate::command_guard::format_guard_log(&pane_id, &result));
    Ok(result)
}

#[tauri::command]
pub fn report_command_guard_ui_request(
    pane_id: String,
    request_id: String,
    command: String,
    decision: String,
    severity: String,
    matched_rule: Option<String>,
    matched_source: Option<String>,
) {
    let mut line = format!(
        "command-guard-ui-request pane={pane_id} request_id={request_id} decision={decision} severity={severity}"
    );
    if let Some(rule) = matched_rule {
        line.push_str(&format!(" matched_rule={}", log_value(&rule)));
    }
    if let Some(source) = matched_source {
        line.push_str(&format!(" matched_source={source}"));
    }
    line.push_str(&format!(" command={}", log_value(&command)));
    crate::pty::diag_log(&line);
}

#[tauri::command]
pub fn respond_command_guard(
    pane_id: String,
    request_id: String,
    command: String,
    decision: String,
    action: String,
    matched_rule: Option<String>,
    matched_source: Option<String>,
) -> Result<(), String> {
    let action = if action == "run" { "run" } else { "cancel" };
    fs::write(command_guard_response_path(&request_id)?, action)
        .map_err(|e| format!("write guard response failed: {e}"))?;

    let mut line = format!(
        "command-guard-ui-action pane={pane_id} request_id={request_id} decision={decision} action={action}"
    );
    if let Some(rule) = matched_rule {
        line.push_str(&format!(" matched_rule={}", log_value(&rule)));
    }
    if let Some(source) = matched_source {
        line.push_str(&format!(" matched_source={source}"));
    }
    line.push_str(&format!(" command={}", log_value(&command)));
    crate::pty::diag_log(&line);
    Ok(())
}

fn command_guard_response_path(request_id: &str) -> Result<PathBuf, String> {
    if request_id.is_empty()
        || !request_id
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
    {
        return Err("invalid guard request id".to_string());
    }
    Ok(PathBuf::from(format!(
        "/tmp/andspace-guard-{request_id}.response"
    )))
}

fn log_value(value: &str) -> String {
    value.replace('\n', "\\n")
}

#[tauri::command]
pub fn open_url(url: String) -> Result<(), String> {
    // Use macOS `open` to route to the registered URL handler.
    std::process::Command::new("open")
        .arg(&url)
        .spawn()
        .map(|_| ())
        .map_err(|e| e.to_string())
}
