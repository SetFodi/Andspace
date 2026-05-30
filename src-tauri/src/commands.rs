use crate::pty::PtyManager;
use serde::Serialize;
use std::fs;
use std::path::PathBuf;
use std::process::Command;
use tauri::{AppHandle, State};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PublicDiagnostics {
    pub andspace_version: String,
    pub os_name: String,
    pub os_version: String,
    pub architecture: String,
    pub preferences_path: String,
    pub workspace_path: String,
    pub diagnostics_log_path: String,
    pub install_method: String,
}

#[tauri::command]
pub fn create_pty(
    app: AppHandle,
    state: State<'_, PtyManager>,
    cols: u16,
    rows: u16,
    cwd: Option<String>,
    command_guard_enabled: Option<bool>,
    shell_preference: Option<crate::shell_setup::ShellLaunchPreference>,
) -> Result<crate::pty::CreatedPty, String> {
    state.create(
        app,
        cols,
        rows,
        cwd,
        command_guard_enabled.unwrap_or(true),
        shell_preference,
    )
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
pub fn ack_pty_output(state: State<'_, PtyManager>, pane_id: String, bytes: usize) {
    state.ack_output(&pane_id, bytes);
}

#[tauri::command]
pub fn report_renderer(kind: String) {
    crate::pty::diag_log(&format!("renderer={kind}"));
}

#[tauri::command]
pub fn get_public_diagnostics() -> PublicDiagnostics {
    crate::pty::diag_log("diagnostics-copy");
    PublicDiagnostics {
        andspace_version: env!("CARGO_PKG_VERSION").to_string(),
        os_name: "macOS".to_string(),
        os_version: macos_version().unwrap_or_else(|| "unknown".to_string()),
        architecture: std::env::consts::ARCH.to_string(),
        preferences_path: crate::preferences::preferences_path()
            .map(|path| path.display().to_string())
            .unwrap_or_else(|_| "unknown".to_string()),
        workspace_path: crate::workspace::workspace_path()
            .map(|path| path.display().to_string())
            .unwrap_or_else(|_| "unknown".to_string()),
        diagnostics_log_path: "/tmp/andspace-diag.log".to_string(),
        install_method: "unknown".to_string(),
    }
}

#[tauri::command]
pub fn detect_shell_setup() -> crate::shell_setup::ShellSetupStatus {
    crate::shell_setup::detect_shell_setup()
}

#[tauri::command]
pub fn install_recommended_shell_tools() -> Result<crate::shell_setup::ShellSetupStatus, String> {
    crate::shell_setup::install_recommended_shell_tools()
}

fn macos_version() -> Option<String> {
    let output = Command::new("sw_vers")
        .arg("-productVersion")
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }
    let version = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if version.is_empty() {
        None
    } else {
        Some(version)
    }
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
    cwd: String,
) -> Result<crate::ai_handoff::PreparedAiHandoff, String> {
    crate::ai_handoff::prepare_ai_cli_handoff(target, &prompt, &cwd)
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
pub fn expand_project_directory(
    path: String,
) -> Result<Vec<crate::project_sidebar::ProjectTreeNode>, String> {
    let result = crate::project_sidebar::expand_project_directory(&path);
    if result.is_ok() {
        crate::pty::diag_log(&format!("project-tree-expand path={}", log_value(&path)));
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

#[tauri::command]
pub fn resolve_project_root(
    cwd: String,
) -> Result<crate::project_sidebar::ResolvedProjectRoot, String> {
    let resolved = crate::project_sidebar::resolve_project_root(&cwd);
    crate::pty::diag_log(&format!(
        "project-root-resolve cwd={} root={} marker={}",
        log_value(&resolved.cwd),
        log_value(&resolved.root),
        resolved.marker.as_deref().unwrap_or("none")
    ));
    Ok(resolved)
}

#[tauri::command]
pub fn detect_external_editors() -> crate::file_actions::AvailableEditors {
    crate::file_actions::detect_external_editors()
}

#[tauri::command]
pub fn open_in_external_editor(tool: String, path: String) -> Result<(), String> {
    let result = crate::file_actions::open_in_external_editor(&tool, &path);
    match &result {
        Ok(_) => crate::pty::diag_log(&format!(
            "file-action-open target={} path={}",
            log_value(&tool),
            log_value(&path)
        )),
        Err(e) => crate::pty::diag_log(&format!(
            "file-action-open-error target={} path={} error={}",
            log_value(&tool),
            log_value(&path),
            log_value(e)
        )),
    }
    result
}

#[tauri::command]
pub fn reveal_in_finder(path: String) -> Result<(), String> {
    let result = crate::file_actions::reveal_in_finder(&path);
    match &result {
        Ok(_) => crate::pty::diag_log(&format!(
            "file-action-open target=finder path={}",
            log_value(&path)
        )),
        Err(e) => crate::pty::diag_log(&format!(
            "file-action-open-error target=finder path={} error={}",
            log_value(&path),
            log_value(e)
        )),
    }
    result
}

#[tauri::command]
pub fn build_nvim_split_command(path: String) -> String {
    crate::file_actions::nvim_split_command(&path)
}

#[tauri::command]
pub fn report_file_action_event(event: String, target: String, path: String) {
    let event = match event.as_str() {
        "copy" | "nvim-split" | "file-picker-open" | "file-picker-select" => event,
        _ => "file-action-unknown".to_string(),
    };
    let line = if event == "copy" {
        format!("file-action-open target=copy path={}", log_value(&path))
    } else if event == "nvim-split" {
        format!("file-action-open target=nvim path={}", log_value(&path))
    } else if event == "file-picker-open" {
        format!("file-picker-open cwd={}", log_value(&path))
    } else if event == "file-picker-select" {
        format!("file-picker-select path={}", log_value(&path))
    } else {
        format!(
            "file-action-unknown target={} path={}",
            log_value(&target),
            log_value(&path)
        )
    };
    crate::pty::diag_log(&line);
}

#[tauri::command]
pub fn report_server_event(
    event: String,
    url: Option<String>,
    pane_id: Option<String>,
    label: Option<String>,
) {
    let url = url.unwrap_or_default();
    let line = match event.as_str() {
        "server-detected" => format!(
            "server-detected url={} pane={} label={}",
            log_value(&url),
            log_value(pane_id.as_deref().unwrap_or("")),
            log_value(label.as_deref().unwrap_or("")),
        ),
        "server-open" => format!("server-open url={}", log_value(&url)),
        "server-copy" => format!("server-copy url={}", log_value(&url)),
        "server-duplicate-ignored" => {
            format!("server-duplicate-ignored url={}", log_value(&url))
        }
        "server-section-empty" => "server-section-empty".to_string(),
        _ => format!("server-unknown event={}", log_value(&event)),
    };
    crate::pty::diag_log(&line);
}

#[tauri::command]
pub fn load_git_status(cwd: String) -> Result<crate::git_status::GitStatus, String> {
    crate::git_status::load_git_status(&cwd)
}

#[tauri::command]
pub fn load_git_diff(
    cwd: String,
    file: crate::git_status::GitChangedFile,
) -> Result<crate::git_status::GitDiffPreview, String> {
    crate::git_status::load_git_diff(&cwd, file)
}

#[tauri::command]
pub fn report_git_event(event: String, cwd: Option<String>, path: Option<String>) {
    crate::git_status::report_git_event(&event, cwd.as_deref(), path.as_deref());
}

#[tauri::command]
pub fn load_workspace_state() -> Result<Option<crate::workspace::WorkspaceSnapshot>, String> {
    crate::workspace::load_workspace_state()
}

#[tauri::command]
pub fn save_workspace_state(snapshot: crate::workspace::WorkspaceSnapshot) -> Result<(), String> {
    crate::workspace::save_workspace_state(&snapshot)
}

#[tauri::command]
pub fn reset_workspace_state() -> Result<(), String> {
    crate::workspace::reset_workspace_state()
}

#[tauri::command]
pub fn load_preferences_state() -> Result<crate::preferences::Preferences, String> {
    crate::preferences::load_preferences_state()
}

#[tauri::command]
pub fn save_preferences_state(preferences: crate::preferences::Preferences) -> Result<(), String> {
    crate::preferences::save_preferences_state(&preferences)
}
