use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::process::Command;

const RECOMMENDED_TOOLS: &[RecommendedShellTool] = &[
    RecommendedShellTool {
        id: "zoxide",
        title: "zoxide",
        package: "zoxide",
        binary: Some("zoxide"),
        description: "Fast project jumping with the z command.",
    },
    RecommendedShellTool {
        id: "autosuggestions",
        title: "zsh-autosuggestions",
        package: "zsh-autosuggestions",
        binary: None,
        description: "Inline suggestions from recent shell history.",
    },
    RecommendedShellTool {
        id: "syntax-highlighting",
        title: "zsh-syntax-highlighting",
        package: "zsh-syntax-highlighting",
        binary: None,
        description: "Subtle command syntax highlighting before Enter.",
    },
    RecommendedShellTool {
        id: "fzf",
        title: "fzf",
        package: "fzf",
        binary: Some("fzf"),
        description: "Fuzzy selection for shell workflows.",
    },
    RecommendedShellTool {
        id: "eza",
        title: "eza",
        package: "eza",
        binary: Some("eza"),
        description: "Cleaner ls-style directory listings.",
    },
];

#[derive(Debug, Clone)]
pub struct ResolvedShell {
    pub path: String,
    pub profile: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ShellSetupStatus {
    pub user_shell: String,
    pub managed_shell: String,
    pub homebrew_path: Option<String>,
    pub tools: Vec<ShellToolStatus>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ShellToolStatus {
    pub id: String,
    pub title: String,
    pub package: String,
    pub description: String,
    pub installed: bool,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ShellLaunchPreference {
    pub profile: Option<String>,
    pub custom_path: Option<String>,
}

struct RecommendedShellTool {
    id: &'static str,
    title: &'static str,
    package: &'static str,
    binary: Option<&'static str>,
    description: &'static str,
}

pub fn resolve_shell(preference: Option<&ShellLaunchPreference>) -> ResolvedShell {
    let profile = preference
        .and_then(|p| p.profile.as_deref())
        .unwrap_or("user-shell");

    match profile {
        "managed-zsh" => ResolvedShell {
            path: managed_zsh_path(),
            profile: "managed-zsh".to_string(),
        },
        "custom" => {
            let custom = preference
                .and_then(|p| p.custom_path.as_deref())
                .map(str::trim)
                .filter(|path| Path::new(path).is_file())
                .map(str::to_string);
            let has_custom = custom.is_some();
            ResolvedShell {
                path: custom.unwrap_or_else(user_shell_path),
                profile: if has_custom {
                    "custom".to_string()
                } else {
                    "user-shell".to_string()
                },
            }
        }
        _ => ResolvedShell {
            path: user_shell_path(),
            profile: "user-shell".to_string(),
        },
    }
}

pub fn detect_shell_setup() -> ShellSetupStatus {
    crate::pty::diag_log("shell-setup-detect");
    shell_setup_status()
}

pub fn install_recommended_shell_tools() -> Result<ShellSetupStatus, String> {
    let brew = homebrew_path().ok_or_else(|| {
        "Homebrew was not found. Install Homebrew first, then try again.".to_string()
    })?;
    let missing: Vec<&str> = RECOMMENDED_TOOLS
        .iter()
        .filter(|tool| !is_tool_installed(tool, Some(&brew)))
        .map(|tool| tool.package)
        .collect();

    if missing.is_empty() {
        crate::pty::diag_log("shell-tools-install result=ok packages=none");
        return Ok(shell_setup_status());
    }

    crate::pty::diag_log(&format!(
        "shell-tools-install result=start packages={}",
        missing.join(",")
    ));
    let output = Command::new(&brew)
        .arg("install")
        .args(&missing)
        .output()
        .map_err(|e| format!("failed to run brew install: {e}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        crate::pty::diag_log(&format!(
            "shell-tools-install result=error packages={} error={}",
            missing.join(","),
            log_value(&stderr)
        ));
        return Err(if stderr.is_empty() {
            "brew install failed".to_string()
        } else {
            stderr
        });
    }

    crate::pty::diag_log(&format!(
        "shell-tools-install result=ok packages={}",
        missing.join(",")
    ));
    Ok(shell_setup_status())
}

pub fn homebrew_prefix() -> Option<PathBuf> {
    if let Some(brew) = homebrew_path() {
        let output = Command::new(&brew).arg("--prefix").output().ok()?;
        if output.status.success() {
            let prefix = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if !prefix.is_empty() {
                return Some(PathBuf::from(prefix));
            }
        }
    }

    for path in ["/opt/homebrew", "/usr/local"] {
        let prefix = PathBuf::from(path);
        if prefix.join("bin").is_dir() {
            return Some(prefix);
        }
    }
    None
}

fn shell_setup_status() -> ShellSetupStatus {
    let brew = homebrew_path();
    ShellSetupStatus {
        user_shell: user_shell_path(),
        managed_shell: managed_zsh_path(),
        homebrew_path: brew.as_ref().map(|path| path.display().to_string()),
        tools: RECOMMENDED_TOOLS
            .iter()
            .map(|tool| ShellToolStatus {
                id: tool.id.to_string(),
                title: tool.title.to_string(),
                package: tool.package.to_string(),
                description: tool.description.to_string(),
                installed: is_tool_installed(tool, brew.as_deref()),
            })
            .collect(),
    }
}

fn managed_zsh_path() -> String {
    if Path::new("/bin/zsh").is_file() {
        "/bin/zsh".to_string()
    } else {
        user_shell_path()
    }
}

fn user_shell_path() -> String {
    std::env::var("SHELL")
        .ok()
        .filter(|path| Path::new(path).is_file())
        .unwrap_or_else(|| "/bin/zsh".to_string())
}

fn homebrew_path() -> Option<PathBuf> {
    for path in ["/opt/homebrew/bin/brew", "/usr/local/bin/brew"] {
        let candidate = PathBuf::from(path);
        if candidate.is_file() {
            return Some(candidate);
        }
    }
    find_executable("brew")
}

fn is_tool_installed(tool: &RecommendedShellTool, brew: Option<&Path>) -> bool {
    if let Some(binary) = tool.binary {
        if find_executable(binary).is_some() {
            return true;
        }
    }

    if let Some(brew) = brew {
        if let Ok(output) = Command::new(brew)
            .arg("list")
            .arg("--versions")
            .arg(tool.package)
            .output()
        {
            return output.status.success() && !output.stdout.is_empty();
        }
    }

    false
}

fn find_executable(name: &str) -> Option<PathBuf> {
    let path = std::env::var_os("PATH")?;
    for entry in std::env::split_paths(&path) {
        let candidate = entry.join(name);
        if candidate.is_file() {
            return Some(candidate);
        }
    }
    None
}

fn log_value(value: &str) -> String {
    value.replace('\n', "\\n")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn managed_profile_uses_zsh() {
        let pref = ShellLaunchPreference {
            profile: Some("managed-zsh".to_string()),
            custom_path: None,
        };
        let resolved = resolve_shell(Some(&pref));

        assert_eq!(resolved.profile, "managed-zsh");
        assert!(resolved.path.ends_with("zsh"));
    }

    #[test]
    fn custom_profile_falls_back_when_path_is_missing() {
        let pref = ShellLaunchPreference {
            profile: Some("custom".to_string()),
            custom_path: Some("/definitely/not/a/shell".to_string()),
        };
        let resolved = resolve_shell(Some(&pref));

        assert_eq!(resolved.profile, "user-shell");
        assert!(!resolved.path.is_empty());
    }
}
