#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod pty;

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
            open_url,
        ])
        .run(tauri::generate_context!())
        .expect("error while running andspace");
}
