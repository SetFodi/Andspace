use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::fs;
use std::path::PathBuf;

const WORKSPACE_VERSION: u32 = 1;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceSnapshot {
    #[serde(default = "default_version")]
    pub version: u32,
    #[serde(default)]
    pub saved_at: Option<u64>,
    #[serde(default)]
    pub active_tab_id: Option<String>,
    #[serde(default)]
    pub active_pane_id: Option<String>,
    #[serde(default)]
    pub active_pane_by_tab: BTreeMap<String, String>,
    #[serde(default)]
    pub tabs: Vec<WorkspaceTab>,
    #[serde(default)]
    pub panes: BTreeMap<String, WorkspacePane>,
    #[serde(default)]
    pub sidebar: WorkspaceSidebar,
    #[serde(default)]
    pub project_root: Option<String>,
    #[serde(default)]
    pub window: Option<WorkspaceWindow>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceTab {
    pub id: String,
    pub title: String,
    pub root: WorkspaceSplitNode,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum WorkspaceSplitNode {
    #[serde(rename = "pane")]
    Pane {
        #[serde(rename = "paneId")]
        pane_id: String,
    },
    #[serde(rename = "split")]
    Split {
        direction: WorkspaceSplitDirection,
        a: Box<WorkspaceSplitNode>,
        b: Box<WorkspaceSplitNode>,
    },
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum WorkspaceSplitDirection {
    Row,
    Column,
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspacePane {
    #[serde(default)]
    pub cwd: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceSidebar {
    #[serde(default)]
    pub open: bool,
    #[serde(default)]
    pub focused_section: Option<String>,
    #[serde(default)]
    pub width: Option<u32>,
}

impl Default for WorkspaceSidebar {
    fn default() -> Self {
        Self {
            open: false,
            focused_section: Some("files".to_string()),
            width: Some(256),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceWindow {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
}

pub fn load_workspace_state() -> Result<Option<WorkspaceSnapshot>, String> {
    let path = workspace_path()?;
    if !path.is_file() {
        crate::pty::diag_log("workspace-load result=missing");
        return Ok(None);
    }

    let raw = fs::read_to_string(&path).map_err(|e| format!("read workspace failed: {e}"))?;
    match serde_json::from_str::<WorkspaceSnapshot>(&raw) {
        Ok(snapshot) => {
            crate::pty::diag_log(&format!(
                "workspace-load result=ok path={}",
                log_value(&path.display().to_string())
            ));
            Ok(Some(snapshot))
        }
        Err(e) => {
            crate::pty::diag_log(&format!(
                "workspace-load result=error error={}",
                log_value(&e.to_string())
            ));
            Ok(None)
        }
    }
}

pub fn save_workspace_state(snapshot: &WorkspaceSnapshot) -> Result<(), String> {
    let path = workspace_path()?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("create workspace dir failed: {e}"))?;
    }

    let tmp = path.with_extension("json.tmp");
    let raw = serde_json::to_string_pretty(snapshot)
        .map_err(|e| format!("serialize workspace failed: {e}"))?;
    fs::write(&tmp, raw).map_err(|e| format!("write workspace failed: {e}"))?;
    fs::rename(&tmp, &path).map_err(|e| format!("replace workspace failed: {e}"))?;
    crate::pty::diag_log(&format!(
        "workspace-save result=ok path={} tabs={} panes={}",
        log_value(&path.display().to_string()),
        snapshot.tabs.len(),
        snapshot.panes.len()
    ));
    Ok(())
}

pub fn reset_workspace_state() -> Result<(), String> {
    let path = workspace_path()?;
    if path.exists() {
        fs::remove_file(&path).map_err(|e| format!("remove workspace failed: {e}"))?;
    }
    crate::pty::diag_log("workspace-reset");
    Ok(())
}

pub fn workspace_path() -> Result<PathBuf, String> {
    let home = std::env::var("HOME").map_err(|_| "HOME is not set".to_string())?;
    Ok(PathBuf::from(home)
        .join("Library")
        .join("Application Support")
        .join("AndSpace")
        .join("workspace.json"))
}

fn default_version() -> u32 {
    WORKSPACE_VERSION
}

fn log_value(value: &str) -> String {
    value.replace('\n', "\\n")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn workspace_json_round_trips() {
        let snapshot = sample_snapshot();
        let raw = serde_json::to_string(&snapshot).unwrap();
        let parsed: WorkspaceSnapshot = serde_json::from_str(&raw).unwrap();

        assert_eq!(parsed.version, 1);
        assert_eq!(parsed.tabs.len(), 1);
        assert_eq!(parsed.panes["old-left"].cwd.as_deref(), Some("/tmp"));
        assert_eq!(parsed.sidebar.open, true);
        assert_eq!(parsed.window.as_ref().unwrap().width, 1200);
    }

    #[test]
    fn workspace_json_tolerates_missing_optional_fields() {
        let raw = r#"{
          "tabs": [{
            "id": "tab-1",
            "title": "shell",
            "root": { "kind": "pane", "paneId": "pane-1" }
          }]
        }"#;
        let parsed: WorkspaceSnapshot = serde_json::from_str(raw).unwrap();

        assert_eq!(parsed.version, 1);
        assert_eq!(parsed.tabs.len(), 1);
        assert_eq!(parsed.sidebar.open, false);
        assert!(parsed.panes.is_empty());
    }

    #[test]
    fn workspace_json_tolerates_newer_version_number() {
        let raw = r#"{
          "version": 99,
          "tabs": [{
            "id": "tab-1",
            "title": "shell",
            "root": { "kind": "pane", "paneId": "pane-1" }
          }]
        }"#;
        let parsed: WorkspaceSnapshot = serde_json::from_str(raw).unwrap();

        assert_eq!(parsed.version, 99);
        assert_eq!(parsed.tabs[0].id, "tab-1");
    }

    fn sample_snapshot() -> WorkspaceSnapshot {
        let mut panes = BTreeMap::new();
        panes.insert(
            "old-left".to_string(),
            WorkspacePane {
                cwd: Some("/tmp".to_string()),
            },
        );
        panes.insert(
            "old-right".to_string(),
            WorkspacePane {
                cwd: Some("/".to_string()),
            },
        );
        let mut active_pane_by_tab = BTreeMap::new();
        active_pane_by_tab.insert("tab-1".to_string(), "old-right".to_string());

        WorkspaceSnapshot {
            version: 1,
            saved_at: Some(123),
            active_tab_id: Some("tab-1".to_string()),
            active_pane_id: Some("old-right".to_string()),
            active_pane_by_tab,
            tabs: vec![WorkspaceTab {
                id: "tab-1".to_string(),
                title: "shell".to_string(),
                root: WorkspaceSplitNode::Split {
                    direction: WorkspaceSplitDirection::Row,
                    a: Box::new(WorkspaceSplitNode::Pane {
                        pane_id: "old-left".to_string(),
                    }),
                    b: Box::new(WorkspaceSplitNode::Pane {
                        pane_id: "old-right".to_string(),
                    }),
                },
            }],
            panes,
            sidebar: WorkspaceSidebar {
                open: true,
                focused_section: Some("servers".to_string()),
                width: Some(256),
            },
            project_root: Some("/tmp".to_string()),
            window: Some(WorkspaceWindow {
                x: 10,
                y: 20,
                width: 1200,
                height: 800,
            }),
        }
    }
}
