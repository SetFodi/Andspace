use std::collections::HashSet;
use std::path::{Path, PathBuf};
use std::process::{Command, Output, Stdio};
use std::thread;
use std::time::{Duration, Instant};

const SHELL_RESOLVE_TIMEOUT: Duration = Duration::from_millis(1500);
const SHELL_MARKER: &str = "__ANDSPACE_TOOL_PATH__";

pub fn resolve_executable(command: &str) -> Option<PathBuf> {
    if !is_safe_command_name(command) {
        return None;
    }

    find_executable_in_paths(&search_paths(), command).or_else(|| resolve_with_user_shell(command))
}

pub fn command_available(command: &str) -> bool {
    resolve_executable(command).is_some()
}

pub fn find_executable_in_paths(paths: &[PathBuf], command: &str) -> Option<PathBuf> {
    paths
        .iter()
        .map(|path| path.join(command))
        .find(|candidate| is_executable(candidate))
}

fn search_paths() -> Vec<PathBuf> {
    let mut paths = Vec::new();

    if let Some(path) = std::env::var_os("PATH") {
        paths.extend(std::env::split_paths(&path));
    }

    if let Some(home) = home_dir() {
        paths.extend([
            home.join(".local/bin"),
            home.join(".cargo/bin"),
            home.join(".bun/bin"),
            home.join(".volta/bin"),
            home.join(".npm-global/bin"),
            home.join(".yarn/bin"),
            home.join(".pyenv/bin"),
            home.join(".pyenv/shims"),
            home.join("Library/pnpm"),
        ]);
    }

    paths.extend([
        PathBuf::from("/opt/homebrew/bin"),
        PathBuf::from("/opt/homebrew/sbin"),
        PathBuf::from("/usr/local/bin"),
        PathBuf::from("/usr/local/sbin"),
        PathBuf::from("/usr/bin"),
        PathBuf::from("/bin"),
        PathBuf::from("/usr/sbin"),
        PathBuf::from("/sbin"),
        PathBuf::from("/Applications/Visual Studio Code.app/Contents/Resources/app/bin"),
        PathBuf::from("/Applications/Cursor.app/Contents/Resources/app/bin"),
    ]);

    dedupe_paths(paths)
}

fn resolve_with_user_shell(command: &str) -> Option<PathBuf> {
    let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".to_string());
    if !Path::new(&shell).is_file() {
        return None;
    }

    let script = format!(
        r#"path="$(command -v "$ANDSPACE_TOOL_NAME" 2>/dev/null)" || exit 0
if [ -n "$path" ]; then
  printf '{}%s\n' "$path"
fi"#,
        SHELL_MARKER
    );

    let mut cmd = Command::new(shell);
    cmd.arg("-ilc")
        .arg(script)
        .env("ANDSPACE_TOOL_NAME", command)
        .env("TERM", "dumb")
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::null());

    let output = run_with_timeout(cmd, SHELL_RESOLVE_TIMEOUT)?;
    let stdout = String::from_utf8_lossy(&output.stdout);
    stdout.lines().find_map(|line| {
        let path = line.strip_prefix(SHELL_MARKER)?.trim();
        let candidate = PathBuf::from(path);
        is_executable(&candidate).then_some(candidate)
    })
}

fn run_with_timeout(mut command: Command, timeout: Duration) -> Option<Output> {
    let mut child = command.spawn().ok()?;
    let started = Instant::now();

    loop {
        if child.try_wait().ok()?.is_some() {
            return child.wait_with_output().ok();
        }
        if started.elapsed() >= timeout {
            let _ = child.kill();
            let _ = child.wait();
            return None;
        }
        thread::sleep(Duration::from_millis(25));
    }
}

fn home_dir() -> Option<PathBuf> {
    std::env::var_os("HOME").map(PathBuf::from)
}

fn dedupe_paths(paths: Vec<PathBuf>) -> Vec<PathBuf> {
    let mut seen = HashSet::new();
    let mut out = Vec::new();
    for path in paths {
        if path.as_os_str().is_empty() {
            continue;
        }
        if seen.insert(path.clone()) {
            out.push(path);
        }
    }
    out
}

fn is_safe_command_name(command: &str) -> bool {
    !command.is_empty()
        && command
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || matches!(b, b'-' | b'_' | b'.' | b'+'))
}

#[cfg(unix)]
pub fn is_executable(path: &Path) -> bool {
    use std::os::unix::fs::PermissionsExt;

    path.is_file()
        && path
            .metadata()
            .map(|metadata| metadata.permissions().mode() & 0o111 != 0)
            .unwrap_or(false)
}

#[cfg(not(unix))]
pub fn is_executable(path: &Path) -> bool {
    path.is_file()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn finds_executable_in_explicit_paths() {
        let root = unique_temp_dir("tool-resolver");
        let tool = root.join("demo-tool");
        fs::write(&tool, "#!/bin/sh\n").unwrap();
        make_executable(&tool);

        assert_eq!(
            find_executable_in_paths(&[root.clone()], "demo-tool"),
            Some(tool)
        );
        assert_eq!(find_executable_in_paths(&[root.clone()], "missing"), None);

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn rejects_unsafe_command_names() {
        assert!(is_safe_command_name("codex"));
        assert!(is_safe_command_name("cursor-agent"));
        assert!(!is_safe_command_name("codex;rm"));
        assert!(!is_safe_command_name("../codex"));
    }

    fn unique_temp_dir(label: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "andspace-{label}-{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn make_executable(path: &Path) {
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let mut permissions = fs::metadata(path).unwrap().permissions();
            permissions.set_mode(0o755);
            fs::set_permissions(path, permissions).unwrap();
        }
    }
}
