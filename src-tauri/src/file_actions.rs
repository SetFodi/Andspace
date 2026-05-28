use serde::Serialize;
use std::path::Path;

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AvailableEditors {
    pub cursor: bool,
    pub code: bool,
    pub nvim: bool,
    pub vim: bool,
}

pub fn detect_external_editors() -> AvailableEditors {
    AvailableEditors {
        cursor: which_on_path("cursor"),
        code: which_on_path("code"),
        nvim: which_on_path("nvim"),
        vim: which_on_path("vim"),
    }
}

/// Lightweight PATH walker — checks each PATH entry for a binary with the
/// given name. Doesn't try to `exec` anything, so this is safe to call on
/// startup or every time the sidebar opens.
pub fn which_on_path(cmd: &str) -> bool {
    let Ok(path) = std::env::var("PATH") else {
        return false;
    };
    for dir in path.split(':') {
        if dir.is_empty() {
            continue;
        }
        let candidate = Path::new(dir).join(cmd);
        if candidate.is_file() {
            return true;
        }
    }
    false
}

/// Spawn an external editor (Cursor or VS Code) with the file path. nvim is
/// handled in the frontend because it runs inside a split pane, not as a
/// detached app.
pub fn open_in_external_editor(tool: &str, path: &str) -> Result<(), String> {
    if !matches!(tool, "cursor" | "code") {
        return Err(format!("unsupported tool: {tool}"));
    }
    let p = Path::new(path);
    if !p.exists() {
        return Err(format!("path does not exist: {path}"));
    }
    std::process::Command::new(tool)
        .arg(path)
        .spawn()
        .map(|_| ())
        .map_err(|e| format!("spawn {tool} failed: {e}"))
}

pub fn reveal_in_finder(path: &str) -> Result<(), String> {
    let p = Path::new(path);
    if !p.exists() {
        return Err(format!("path does not exist: {path}"));
    }
    std::process::Command::new("open")
        .arg("-R")
        .arg(path)
        .spawn()
        .map(|_| ())
        .map_err(|e| format!("open -R failed: {e}"))
}

/// Build the shell command that launches nvim against a file. The frontend
/// pipes this into a freshly-split pane. Quoting is deliberately simple
/// because we control the input shape (project file paths only).
pub fn nvim_split_command(path: &str) -> String {
    format!("nvim {}", shell_quote(path))
}

fn shell_quote(value: &str) -> String {
    format!("'{}'", value.replace('\'', "'\\''"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn nvim_command_quotes_paths_with_spaces_and_quotes() {
        assert_eq!(nvim_split_command("/tmp/foo.txt"), "nvim '/tmp/foo.txt'");
        assert_eq!(
            nvim_split_command("/tmp/has space.txt"),
            "nvim '/tmp/has space.txt'"
        );
        assert_eq!(
            nvim_split_command("/tmp/it's mine.txt"),
            "nvim '/tmp/it'\\''s mine.txt'"
        );
    }

    #[test]
    fn open_in_external_editor_rejects_unknown_tools() {
        let err = open_in_external_editor("vim", "/tmp/whatever").unwrap_err();
        assert!(err.contains("unsupported tool"));
        let err = open_in_external_editor("rm", "/tmp/whatever").unwrap_err();
        assert!(err.contains("unsupported tool"));
    }

    #[test]
    fn which_on_path_finds_a_known_binary() {
        // `sh` exists on every Unix the tests will ever run on.
        assert!(which_on_path("sh"));
        // Random nonsense shouldn't.
        assert!(!which_on_path("definitely-not-a-real-binary-andspace-test"));
    }
}
