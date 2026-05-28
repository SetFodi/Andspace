use serde::{Deserialize, Serialize};
use std::io::Read;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};

const MAX_DIFF_BYTES: usize = 300 * 1024;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitStatus {
    pub is_repo: bool,
    pub repo_root: Option<String>,
    pub branch: Option<String>,
    pub files: Vec<GitChangedFile>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitChangedFile {
    pub path: String,
    pub old_path: Option<String>,
    pub status: GitFileStatus,
    pub raw_status: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum GitFileStatus {
    Modified,
    Added,
    Deleted,
    Renamed,
    Untracked,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitDiffPreview {
    pub repo_root: String,
    pub path: String,
    pub old_path: Option<String>,
    pub status: GitFileStatus,
    pub raw_status: String,
    pub branch: Option<String>,
    pub diff: String,
    pub too_large: bool,
    pub message: Option<String>,
    pub bytes: usize,
}

pub fn load_git_status(cwd: &str) -> Result<GitStatus, String> {
    let root = match find_git_root(cwd) {
        Some(root) => root,
        None => {
            crate::pty::diag_log(&format!(
                "git-status-load cwd={} result=no-repo",
                log_value(cwd)
            ));
            return Ok(GitStatus {
                is_repo: false,
                repo_root: None,
                branch: None,
                files: Vec::new(),
            });
        }
    };

    let output = Command::new("git")
        .args(["status", "--porcelain=v1", "-b"])
        .current_dir(&root)
        .output()
        .map_err(|e| format!("git status failed: {e}"))?;

    if !output.status.success() {
        let error = String::from_utf8_lossy(&output.stderr).trim().to_string();
        crate::pty::diag_log(&format!(
            "git-status-error cwd={} error={}",
            log_value(cwd),
            log_value(&error)
        ));
        return Err(if error.is_empty() {
            "git status failed".to_string()
        } else {
            error
        });
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let status = parse_git_status(&stdout, root.display().to_string());
    crate::pty::diag_log(&format!(
        "git-status-load cwd={} result=ok repo={} files={}",
        log_value(cwd),
        log_value(status.repo_root.as_deref().unwrap_or("")),
        status.files.len()
    ));
    Ok(status)
}

pub fn load_git_diff(cwd: &str, file: GitChangedFile) -> Result<GitDiffPreview, String> {
    let root = match find_git_root(cwd) {
        Some(root) => root,
        None => {
            crate::pty::diag_log(&format!(
                "git-diff-error path={} cwd={}",
                log_value(&file.path),
                log_value(cwd)
            ));
            return Err("No Git repository found".to_string());
        }
    };

    let branch = read_branch(&root);
    let repo_root = root.display().to_string();

    if file.status == GitFileStatus::Untracked {
        crate::pty::diag_log(&format!(
            "git-diff-load path={} result=ok bytes=0",
            log_value(&file.path)
        ));
        return Ok(GitDiffPreview {
            repo_root,
            path: file.path,
            old_path: file.old_path,
            status: file.status,
            raw_status: file.raw_status,
            branch,
            diff: String::new(),
            too_large: false,
            message: Some("Untracked file — no git diff yet. Open file instead.".to_string()),
            bytes: 0,
        });
    }

    let plan = match diff_command_for_file(&file) {
        Some(plan) => plan,
        None => {
            crate::pty::diag_log(&format!("git-diff-error path={}", log_value(&file.path)));
            return Err("No diff is available for this file".to_string());
        }
    };

    match run_diff_command(&root, &plan, &file.path)? {
        BoundedDiffOutput::TooLarge { bytes } => {
            crate::pty::diag_log(&format!(
                "git-diff-too-large path={} bytes={}",
                log_value(&file.path),
                bytes
            ));
            Ok(GitDiffPreview {
                repo_root,
                path: file.path,
                old_path: file.old_path,
                status: file.status,
                raw_status: file.raw_status,
                branch,
                diff: String::new(),
                too_large: true,
                message: Some("Diff too large to preview. Open in external editor.".to_string()),
                bytes,
            })
        }
        BoundedDiffOutput::Ok { diff, bytes } => {
            crate::pty::diag_log(&format!(
                "git-diff-load path={} result=ok bytes={}",
                log_value(&file.path),
                bytes
            ));
            Ok(GitDiffPreview {
                repo_root,
                path: file.path,
                old_path: file.old_path,
                status: file.status,
                raw_status: file.raw_status,
                branch,
                diff,
                too_large: false,
                message: None,
                bytes,
            })
        }
    }
}

pub fn report_git_event(event: &str, cwd: Option<&str>, path: Option<&str>) {
    match event {
        "git-refresh" => crate::pty::diag_log("git-refresh"),
        "git-file-open" => crate::pty::diag_log(&format!(
            "git-file-open path={}",
            log_value(path.unwrap_or(""))
        )),
        "git-status-error" => crate::pty::diag_log(&format!(
            "git-status-error cwd={}",
            log_value(cwd.unwrap_or(""))
        )),
        "git-diff-copy" => crate::pty::diag_log(&format!(
            "git-diff-copy path={}",
            log_value(path.unwrap_or(""))
        )),
        _ => crate::pty::diag_log(&format!("git-unknown event={}", log_value(event))),
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct DiffCommandPlan {
    cached: bool,
    path: String,
}

enum BoundedDiffOutput {
    Ok { diff: String, bytes: usize },
    TooLarge { bytes: usize },
}

fn diff_command_for_file(file: &GitChangedFile) -> Option<DiffCommandPlan> {
    if file.status == GitFileStatus::Untracked {
        return None;
    }
    Some(DiffCommandPlan {
        cached: has_staged_status(&file.raw_status),
        path: file.path.clone(),
    })
}

fn has_staged_status(raw_status: &str) -> bool {
    raw_status
        .chars()
        .next()
        .is_some_and(|c| c != ' ' && c != '?')
}

fn diff_is_too_large(bytes: usize) -> bool {
    bytes > MAX_DIFF_BYTES
}

fn run_diff_command(
    root: &Path,
    plan: &DiffCommandPlan,
    log_path: &str,
) -> Result<BoundedDiffOutput, String> {
    let mut command = Command::new("git");
    command.args(["diff", "--no-ext-diff"]);
    if plan.cached {
        command.arg("--cached");
    }
    command
        .arg("--")
        .arg(&plan.path)
        .current_dir(root)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    let mut child = command.spawn().map_err(|e| {
        crate::pty::diag_log(&format!(
            "git-diff-error path={} error={}",
            log_value(log_path),
            log_value(&e.to_string())
        ));
        format!("git diff failed: {e}")
    })?;

    let Some(mut stdout) = child.stdout.take() else {
        let _ = child.kill();
        crate::pty::diag_log(&format!("git-diff-error path={}", log_value(log_path)));
        return Err("git diff stdout unavailable".to_string());
    };

    let mut data = Vec::new();
    let mut buffer = [0_u8; 8192];
    loop {
        let read = stdout.read(&mut buffer).map_err(|e| {
            let _ = child.kill();
            crate::pty::diag_log(&format!(
                "git-diff-error path={} error={}",
                log_value(log_path),
                log_value(&e.to_string())
            ));
            format!("git diff read failed: {e}")
        })?;
        if read == 0 {
            break;
        }
        data.extend_from_slice(&buffer[..read]);
        if diff_is_too_large(data.len()) {
            let _ = child.kill();
            let _ = child.wait();
            return Ok(BoundedDiffOutput::TooLarge { bytes: data.len() });
        }
    }

    let mut stderr = String::new();
    if let Some(mut pipe) = child.stderr.take() {
        let _ = pipe.read_to_string(&mut stderr);
    }
    let status = child.wait().map_err(|e| {
        crate::pty::diag_log(&format!(
            "git-diff-error path={} error={}",
            log_value(log_path),
            log_value(&e.to_string())
        ));
        format!("git diff failed: {e}")
    })?;

    if !status.success() {
        let error = stderr.trim().to_string();
        crate::pty::diag_log(&format!(
            "git-diff-error path={} error={}",
            log_value(log_path),
            log_value(&error)
        ));
        return Err(if error.is_empty() {
            "git diff failed".to_string()
        } else {
            error
        });
    }

    let bytes = data.len();
    let diff = String::from_utf8_lossy(&data).to_string();
    Ok(BoundedDiffOutput::Ok { diff, bytes })
}

fn read_branch(root: &Path) -> Option<String> {
    let output = Command::new("git")
        .args(["status", "--porcelain=v1", "-b"])
        .current_dir(root)
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }
    let stdout = String::from_utf8_lossy(&output.stdout);
    stdout
        .lines()
        .find_map(|line| line.strip_prefix("## ").and_then(parse_branch))
}

fn parse_git_status(raw: &str, repo_root: String) -> GitStatus {
    let mut branch = None;
    let mut files = Vec::new();

    for line in raw.lines() {
        if let Some(rest) = line.strip_prefix("## ") {
            branch = parse_branch(rest);
            continue;
        }
        if line.len() < 4 {
            continue;
        }
        if let Some(file) = parse_changed_file(line) {
            files.push(file);
        }
    }

    GitStatus {
        is_repo: true,
        repo_root: Some(repo_root),
        branch,
        files,
    }
}

fn parse_branch(value: &str) -> Option<String> {
    let head = value.split("...").next().unwrap_or(value).trim();
    if head.is_empty() {
        None
    } else if head == "HEAD (no branch)" {
        Some("detached".to_string())
    } else if let Some(branch) = head.strip_prefix("No commits yet on ") {
        Some(branch.to_string())
    } else {
        Some(head.to_string())
    }
}

fn parse_changed_file(line: &str) -> Option<GitChangedFile> {
    let raw_status = line.get(0..2)?.to_string();
    let rest = line.get(3..)?.trim();
    if rest.is_empty() {
        return None;
    }

    let status = map_status(&raw_status);
    let (path, old_path) = if status == GitFileStatus::Renamed {
        match rest.split_once(" -> ") {
            Some((old_path, path)) => (path.to_string(), Some(old_path.to_string())),
            None => (rest.to_string(), None),
        }
    } else {
        (rest.to_string(), None)
    };

    Some(GitChangedFile {
        path,
        old_path,
        status,
        raw_status,
    })
}

fn map_status(raw_status: &str) -> GitFileStatus {
    if raw_status == "??" {
        return GitFileStatus::Untracked;
    }
    if raw_status.contains('R') {
        return GitFileStatus::Renamed;
    }
    if raw_status.contains('D') {
        return GitFileStatus::Deleted;
    }
    if raw_status.contains('A') {
        return GitFileStatus::Added;
    }
    GitFileStatus::Modified
}

fn find_git_root(cwd: &str) -> Option<PathBuf> {
    let mut current = normalize_start_path(cwd)?;
    loop {
        if current.join(".git").exists() {
            return Some(current);
        }
        if !current.pop() {
            return None;
        }
    }
}

fn normalize_start_path(cwd: &str) -> Option<PathBuf> {
    let path = Path::new(cwd);
    let mut current = if path.exists() {
        path.canonicalize().ok()?
    } else {
        path.parent()?.canonicalize().ok()?
    };
    if current.is_file() {
        current.pop();
    }
    Some(current)
}

fn log_value(value: &str) -> String {
    value.replace('\n', "\\n")
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn parses_branch_and_porcelain_files() {
        let raw = "\
## main...origin/main
 M src/App.tsx
A  docs/GIT_CHANGES.md
D  old.txt
R  before.rs -> after.rs
?? scratch.md
";
        let status = parse_git_status(raw, "/repo".to_string());

        assert_eq!(status.branch.as_deref(), Some("main"));
        assert_eq!(status.files.len(), 5);
        assert_eq!(status.files[0].status, GitFileStatus::Modified);
        assert_eq!(status.files[1].status, GitFileStatus::Added);
        assert_eq!(status.files[2].status, GitFileStatus::Deleted);
        assert_eq!(status.files[3].status, GitFileStatus::Renamed);
        assert_eq!(status.files[3].old_path.as_deref(), Some("before.rs"));
        assert_eq!(status.files[3].path, "after.rs");
        assert_eq!(status.files[4].status, GitFileStatus::Untracked);
    }

    #[test]
    fn parses_detached_branch() {
        let status = parse_git_status("## HEAD (no branch)\n", "/repo".to_string());

        assert_eq!(status.branch.as_deref(), Some("detached"));
    }

    #[test]
    fn parses_initial_branch() {
        let status = parse_git_status("## No commits yet on main\n", "/repo".to_string());

        assert_eq!(status.branch.as_deref(), Some("main"));
    }

    #[test]
    fn maps_combined_statuses_to_labels() {
        assert_eq!(map_status("MM"), GitFileStatus::Modified);
        assert_eq!(map_status("AM"), GitFileStatus::Added);
        assert_eq!(map_status("RD"), GitFileStatus::Renamed);
        assert_eq!(map_status(" D"), GitFileStatus::Deleted);
        assert_eq!(map_status("??"), GitFileStatus::Untracked);
    }

    #[test]
    fn builds_worktree_diff_for_unstaged_files() {
        let file = GitChangedFile {
            path: "src/App.tsx".to_string(),
            old_path: None,
            status: GitFileStatus::Modified,
            raw_status: " M".to_string(),
        };

        assert_eq!(
            diff_command_for_file(&file),
            Some(DiffCommandPlan {
                cached: false,
                path: "src/App.tsx".to_string(),
            })
        );
    }

    #[test]
    fn builds_cached_diff_for_staged_files() {
        let file = GitChangedFile {
            path: "docs/GIT_CHANGES.md".to_string(),
            old_path: None,
            status: GitFileStatus::Added,
            raw_status: "A ".to_string(),
        };

        assert_eq!(
            diff_command_for_file(&file),
            Some(DiffCommandPlan {
                cached: true,
                path: "docs/GIT_CHANGES.md".to_string(),
            })
        );
    }

    #[test]
    fn does_not_build_diff_command_for_untracked_files() {
        let file = GitChangedFile {
            path: "scratch.md".to_string(),
            old_path: None,
            status: GitFileStatus::Untracked,
            raw_status: "??".to_string(),
        };

        assert_eq!(diff_command_for_file(&file), None);
    }

    #[test]
    fn returns_untracked_diff_fallback_without_running_git_diff() {
        let root = unique_temp_dir("untracked-diff");
        fs::create_dir_all(root.join(".git")).unwrap();
        let preview = load_git_diff(
            root.to_str().unwrap(),
            GitChangedFile {
                path: "scratch.md".to_string(),
                old_path: None,
                status: GitFileStatus::Untracked,
                raw_status: "??".to_string(),
            },
        )
        .unwrap();

        assert_eq!(preview.path, "scratch.md");
        assert_eq!(preview.status, GitFileStatus::Untracked);
        assert_eq!(preview.diff, "");
        assert!(!preview.too_large);
        assert_eq!(preview.bytes, 0);
        assert_eq!(
            preview.message.as_deref(),
            Some("Untracked file — no git diff yet. Open file instead.")
        );
    }

    #[test]
    fn enforces_diff_size_cap() {
        assert!(!diff_is_too_large(MAX_DIFF_BYTES));
        assert!(diff_is_too_large(MAX_DIFF_BYTES + 1));
    }

    #[test]
    fn finds_git_root_by_walking_upward() {
        let root = unique_temp_dir("git-root");
        fs::create_dir_all(root.join(".git")).unwrap();
        let nested = root.join("a/b/c");
        fs::create_dir_all(&nested).unwrap();

        assert_eq!(
            find_git_root(nested.to_str().unwrap()),
            Some(root.canonicalize().unwrap())
        );
    }

    #[test]
    fn returns_none_when_no_git_root_exists() {
        let root = unique_temp_dir("no-git-root");

        assert_eq!(find_git_root(root.to_str().unwrap()), None);
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
}
