use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

const PREFERENCES_VERSION: u32 = 1;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Preferences {
    #[serde(default = "default_version")]
    pub version: u32,
    #[serde(default)]
    pub saved_at: Option<u64>,
    #[serde(default)]
    pub onboarding_completed: bool,
    #[serde(default)]
    pub theme: ThemePreference,
    #[serde(default)]
    pub terminal: TerminalPreferences,
    #[serde(default)]
    pub workflow: WorkflowPreferences,
    #[serde(default)]
    pub safety: SafetyPreferences,
}

impl Default for Preferences {
    fn default() -> Self {
        Self {
            version: PREFERENCES_VERSION,
            saved_at: None,
            onboarding_completed: false,
            theme: ThemePreference::default(),
            terminal: TerminalPreferences::default(),
            workflow: WorkflowPreferences::default(),
            safety: SafetyPreferences::default(),
        }
    }
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum ThemePreference {
    #[default]
    GraphiteViolet,
    Midnight,
    PureDark,
    SoftContrast,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalPreferences {
    #[serde(default = "default_font_size")]
    pub font_size: u16,
    #[serde(default)]
    pub scrollback_profile: ScrollbackProfile,
}

impl Default for TerminalPreferences {
    fn default() -> Self {
        Self {
            font_size: default_font_size(),
            scrollback_profile: ScrollbackProfile::default(),
        }
    }
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum ScrollbackProfile {
    MemorySaver,
    #[default]
    Balanced,
    LongHistory,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowPreferences {
    #[serde(default)]
    pub default_file_action: DefaultFileAction,
    #[serde(default)]
    pub default_ai_cli: DefaultAiCli,
    #[serde(default)]
    pub server_open_behavior: ServerOpenBehavior,
}

impl Default for WorkflowPreferences {
    fn default() -> Self {
        Self {
            default_file_action: DefaultFileAction::default(),
            default_ai_cli: DefaultAiCli::default(),
            server_open_behavior: ServerOpenBehavior::default(),
        }
    }
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum DefaultFileAction {
    #[default]
    Auto,
    Cursor,
    Code,
    NvimSplit,
    Copy,
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum DefaultAiCli {
    #[default]
    Ask,
    Claude,
    Codex,
    Cursor,
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum ServerOpenBehavior {
    #[default]
    External,
    Preview,
    Ask,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SafetyPreferences {
    #[serde(default = "default_true")]
    pub workspace_restore_enabled: bool,
    #[serde(default = "default_true")]
    pub command_guard_enabled: bool,
}

impl Default for SafetyPreferences {
    fn default() -> Self {
        Self {
            workspace_restore_enabled: true,
            command_guard_enabled: true,
        }
    }
}

pub fn load_preferences_state() -> Result<Preferences, String> {
    let path = preferences_path()?;
    if !path.is_file() {
        crate::pty::diag_log("preferences-load result=missing");
        return Ok(Preferences::default());
    }

    let raw = fs::read_to_string(&path).map_err(|e| format!("read preferences failed: {e}"))?;
    match serde_json::from_str::<Preferences>(&raw) {
        Ok(preferences) => {
            crate::pty::diag_log(&format!(
                "preferences-load result=ok path={}",
                log_value(&path.display().to_string())
            ));
            Ok(preferences)
        }
        Err(e) => {
            crate::pty::diag_log(&format!(
                "preferences-load result=error error={}",
                log_value(&e.to_string())
            ));
            Ok(Preferences::default())
        }
    }
}

pub fn save_preferences_state(preferences: &Preferences) -> Result<(), String> {
    let path = preferences_path()?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("create preferences dir failed: {e}"))?;
    }

    let tmp = path.with_extension("json.tmp");
    let raw = serde_json::to_string_pretty(preferences)
        .map_err(|e| format!("serialize preferences failed: {e}"))?;
    fs::write(&tmp, raw).map_err(|e| format!("write preferences failed: {e}"))?;
    fs::rename(&tmp, &path).map_err(|e| format!("replace preferences failed: {e}"))?;
    crate::pty::diag_log(&format!(
        "preferences-save result=ok path={} onboarding_completed={}",
        log_value(&path.display().to_string()),
        preferences.onboarding_completed
    ));
    Ok(())
}

pub fn preferences_path() -> Result<PathBuf, String> {
    let home = std::env::var("HOME").map_err(|_| "HOME is not set".to_string())?;
    Ok(PathBuf::from(home)
        .join("Library")
        .join("Application Support")
        .join("AndSpace")
        .join("preferences.json"))
}

fn default_version() -> u32 {
    PREFERENCES_VERSION
}

fn default_font_size() -> u16 {
    13
}

fn default_true() -> bool {
    true
}

fn log_value(value: &str) -> String {
    value.replace('\n', "\\n")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn preferences_json_round_trips() {
        let preferences = Preferences {
            version: 1,
            saved_at: Some(123),
            onboarding_completed: true,
            theme: ThemePreference::Midnight,
            terminal: TerminalPreferences {
                font_size: 15,
                scrollback_profile: ScrollbackProfile::LongHistory,
            },
            workflow: WorkflowPreferences {
                default_file_action: DefaultFileAction::Cursor,
                default_ai_cli: DefaultAiCli::Claude,
                server_open_behavior: ServerOpenBehavior::External,
            },
            safety: SafetyPreferences {
                workspace_restore_enabled: false,
                command_guard_enabled: true,
            },
        };

        let raw = serde_json::to_string(&preferences).unwrap();
        let parsed: Preferences = serde_json::from_str(&raw).unwrap();

        assert_eq!(parsed.version, 1);
        assert_eq!(parsed.onboarding_completed, true);
        assert_eq!(parsed.theme, ThemePreference::Midnight);
        assert_eq!(parsed.terminal.font_size, 15);
        assert_eq!(
            parsed.workflow.default_file_action,
            DefaultFileAction::Cursor
        );
        assert_eq!(parsed.safety.workspace_restore_enabled, false);
    }

    #[test]
    fn preferences_json_tolerates_missing_fields() {
        let raw = r#"{
          "onboardingCompleted": true,
          "terminal": { "fontSize": 16 }
        }"#;
        let parsed: Preferences = serde_json::from_str(raw).unwrap();

        assert_eq!(parsed.version, 1);
        assert_eq!(parsed.onboarding_completed, true);
        assert_eq!(parsed.theme, ThemePreference::GraphiteViolet);
        assert_eq!(parsed.terminal.font_size, 16);
        assert_eq!(parsed.terminal.scrollback_profile, ScrollbackProfile::Balanced);
        assert_eq!(parsed.workflow.default_ai_cli, DefaultAiCli::Ask);
        assert_eq!(parsed.safety.command_guard_enabled, true);
    }

    #[test]
    fn preferences_json_tolerates_newer_version_number() {
        let raw = r#"{
          "version": 99,
          "theme": "pure-dark"
        }"#;
        let parsed: Preferences = serde_json::from_str(raw).unwrap();

        assert_eq!(parsed.version, 99);
        assert_eq!(parsed.theme, ThemePreference::PureDark);
    }
}
