use crate::pty::PtyManager;
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
pub fn open_url(url: String) -> Result<(), String> {
    // Use macOS `open` to route to the registered URL handler.
    std::process::Command::new("open")
        .arg(&url)
        .spawn()
        .map(|_| ())
        .map_err(|e| e.to_string())
}
