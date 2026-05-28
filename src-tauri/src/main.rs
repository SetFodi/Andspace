#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod ai_handoff;
mod command_guard;
mod commands;
mod file_actions;
mod git_status;
mod project_sidebar;
mod pty;
mod rules;
mod workspace;

use commands::*;
use pty::PtyManager;
use tauri::menu::{Menu, MenuItem, Submenu};
use tauri::Emitter;

const MENU_SPLIT_RIGHT: &str = "pane.split_right";
const MENU_SPLIT_DOWN: &str = "pane.split_down";

fn main() {
    pty::diag_log("=== app-start ===");
    tauri::Builder::default()
        .menu(|app| {
            let menu = Menu::default(app)?;
            let split_right =
                MenuItem::with_id(app, MENU_SPLIT_RIGHT, "Split Right", true, Some("Cmd+O"))?;
            let split_down =
                MenuItem::with_id(app, MENU_SPLIT_DOWN, "Split Down", true, Some("Cmd+L"))?;
            let pane_menu = Submenu::with_items(app, "Pane", true, &[&split_right, &split_down])?;
            menu.insert(&pane_menu, 4)?;
            Ok(menu)
        })
        .on_menu_event(|app, event| {
            if event.id() == MENU_SPLIT_RIGHT {
                pty::diag_log("native-shortcut action=split-right");
                let _ = app.emit("native-shortcut", "split-right");
            } else if event.id() == MENU_SPLIT_DOWN {
                pty::diag_log("native-shortcut action=split-down");
                let _ = app.emit("native-shortcut", "split-down");
            }
        })
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
            build_ai_handoff_prompt,
            detect_ai_cli_tools,
            prepare_ai_cli_handoff,
            report_ai_handoff_event,
            report_command_palette_event,
            load_project_tree,
            expand_project_directory,
            load_package_scripts,
            report_sidebar_event,
            evaluate_command_guard,
            report_command_guard_ui_request,
            respond_command_guard,
            open_url,
            resolve_project_root,
            detect_external_editors,
            open_in_external_editor,
            reveal_in_finder,
            build_nvim_split_command,
            report_file_action_event,
            report_server_event,
            load_git_status,
            load_git_diff,
            report_git_event,
            load_workspace_state,
            save_workspace_state,
            reset_workspace_state,
        ])
        .run(tauri::generate_context!())
        .expect("error while running andspace");
}
