#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod command_guard;
mod commands;
mod pty;
mod rules;

use commands::*;
use pty::PtyManager;

fn main() {
    pty::diag_log("=== app-start ===");
    tauri::Builder::default()
        .manage(PtyManager::new())
        .invoke_handler(tauri::generate_handler![
            create_pty,
            write_to_pty,
            resize_pty,
            kill_pty,
            report_renderer,
            report_shell_event,
            load_rules_for_cwd,
            init_andspace_rules,
            evaluate_command_guard,
            report_command_guard_ui_request,
            respond_command_guard,
            open_url,
        ])
        .run(tauri::generate_context!())
        .expect("error while running andspace");
}
