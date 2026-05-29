use serde::Serialize;
use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};

const MAX_DEPTH: usize = 3;
const MAX_CHILDREN_PER_DIR: usize = 120;
const MAX_TOTAL_NODES: usize = 900;
pub const IGNORED_DIRS: &[&str] = &[
    "node_modules",
    ".git",
    "dist",
    "build",
    ".next",
    "target",
    "vendor",
];

/// Marker files / directories that we treat as "this is a project root".
/// Order is by preference — first match wins. Lockfiles and Cargo.toml come
/// before .git because a developer rooted in a sub-package usually wants the
/// nearest package root, not the entire monorepo root.
pub const ROOT_MARKERS: &[&str] = &[
    "package.json",
    "pnpm-lock.yaml",
    "yarn.lock",
    "bun.lockb",
    "Cargo.toml",
    ".git",
];

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectTreeNode {
    pub name: String,
    pub path: String,
    pub kind: ProjectTreeNodeKind,
    pub children: Vec<ProjectTreeNode>,
    pub truncated: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum ProjectTreeNodeKind {
    Directory,
    File,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectTree {
    pub root: ProjectTreeNode,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ResolvedProjectRoot {
    pub cwd: String,
    pub root: String,
    pub marker: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PackageScripts {
    pub cwd: String,
    pub package_manager: PackageManager,
    pub scripts: Vec<PackageScript>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum PackageManager {
    Npm,
    Pnpm,
    Bun,
    Yarn,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PackageScript {
    pub name: String,
    pub command: String,
}

pub fn load_project_tree(cwd: &str) -> Result<ProjectTree, String> {
    let root = validate_cwd(cwd)?;
    let mut budget = NodeBudget {
        remaining: MAX_TOTAL_NODES,
    };
    let root = read_node(&root, 0, &mut budget)?;
    Ok(ProjectTree { root })
}

/// Shallow read of a directory's direct children, ignoring the global tree
/// caps. Subdirectory children are returned empty + `truncated: true` so the
/// frontend can lazy-load further levels on demand.
pub fn expand_project_directory(path: &str) -> Result<Vec<ProjectTreeNode>, String> {
    let dir = validate_cwd(path)?;
    let entries = sorted_visible_entries(&dir)?;
    const HARD_CAP: usize = 5000;
    let mut children = Vec::with_capacity(entries.len().min(HARD_CAP));
    for entry in entries.into_iter().take(HARD_CAP) {
        if entry.is_dir() {
            children.push(node(
                &entry,
                ProjectTreeNodeKind::Directory,
                Vec::new(),
                true,
            ));
        } else {
            children.push(node(&entry, ProjectTreeNodeKind::File, Vec::new(), false));
        }
    }
    Ok(children)
}

/// Walk upward from `cwd` looking for a marker file/dir that signals the
/// project root (lockfiles, Cargo.toml, .git). Falls back to the original
/// cwd when no marker is found — that keeps the sidebar useful inside ad-hoc
/// directories without forcing a project structure.
pub fn resolve_project_root(cwd: &str) -> ResolvedProjectRoot {
    let original = PathBuf::from(cwd);
    let cwd_str = original.display().to_string();
    let mut current = original.clone();
    loop {
        for marker in ROOT_MARKERS {
            if current.join(marker).exists() {
                return ResolvedProjectRoot {
                    cwd: cwd_str,
                    root: current.display().to_string(),
                    marker: Some((*marker).to_string()),
                };
            }
        }
        if !current.pop() {
            break;
        }
    }
    ResolvedProjectRoot {
        cwd: cwd_str.clone(),
        root: cwd_str,
        marker: None,
    }
}

pub fn load_package_scripts(cwd: &str) -> Result<PackageScripts, String> {
    let root = validate_cwd(cwd)?;
    let package_json = root.join("package.json");
    let package_manager = detect_package_manager(&root);
    let scripts = if package_json.is_file() {
        let value: serde_json::Value = serde_json::from_str(
            &fs::read_to_string(&package_json)
                .map_err(|e| format!("read {} failed: {e}", package_json.display()))?,
        )
        .map_err(|e| format!("parse {} failed: {e}", package_json.display()))?;
        parse_scripts(&value)
    } else {
        Vec::new()
    };

    Ok(PackageScripts {
        cwd: root.display().to_string(),
        package_manager,
        scripts,
    })
}

#[cfg(test)]
pub fn script_run_command(package_manager: PackageManager, name: &str) -> String {
    match package_manager {
        PackageManager::Npm => format!("npm run {}", shell_quote_word(name)),
        PackageManager::Pnpm => format!("pnpm {}", shell_quote_word(name)),
        PackageManager::Bun => format!("bun run {}", shell_quote_word(name)),
        PackageManager::Yarn => format!("yarn {}", shell_quote_word(name)),
    }
}

fn validate_cwd(cwd: &str) -> Result<PathBuf, String> {
    if cwd.trim().is_empty() {
        return Err("cwd is empty".to_string());
    }
    let path = PathBuf::from(cwd);
    if !path.is_dir() {
        return Err(format!("cwd is not a directory: {}", path.display()));
    }
    Ok(path)
}

struct NodeBudget {
    remaining: usize,
}

fn read_node(
    path: &Path,
    depth: usize,
    budget: &mut NodeBudget,
) -> Result<ProjectTreeNode, String> {
    if budget.remaining == 0 {
        return Ok(node(path, ProjectTreeNodeKind::Directory, Vec::new(), true));
    }
    budget.remaining -= 1;

    if !path.is_dir() {
        return Ok(node(path, ProjectTreeNodeKind::File, Vec::new(), false));
    }

    if depth >= MAX_DEPTH {
        return Ok(node(path, ProjectTreeNodeKind::Directory, Vec::new(), true));
    }

    let entries = sorted_visible_entries(path)?;
    let mut children = Vec::new();
    let mut truncated = entries.len() > MAX_CHILDREN_PER_DIR;

    for entry in entries.into_iter().take(MAX_CHILDREN_PER_DIR) {
        if budget.remaining == 0 {
            truncated = true;
            break;
        }
        children.push(read_node(&entry, depth + 1, budget)?);
    }

    Ok(node(
        path,
        ProjectTreeNodeKind::Directory,
        children,
        truncated,
    ))
}

fn sorted_visible_entries(path: &Path) -> Result<Vec<PathBuf>, String> {
    let mut entries = Vec::new();
    for entry in fs::read_dir(path).map_err(|e| format!("read {} failed: {e}", path.display()))? {
        let entry = entry.map_err(|e| format!("read dir entry failed: {e}"))?;
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();
        if path.is_dir() && IGNORED_DIRS.contains(&name.as_str()) {
            continue;
        }
        entries.push(path);
    }

    entries.sort_by(|a, b| {
        let a_dir = a.is_dir();
        let b_dir = b.is_dir();
        b_dir
            .cmp(&a_dir)
            .then_with(|| name_for_sort(a).cmp(&name_for_sort(b)))
    });
    Ok(entries)
}

fn node(
    path: &Path,
    kind: ProjectTreeNodeKind,
    children: Vec<ProjectTreeNode>,
    truncated: bool,
) -> ProjectTreeNode {
    ProjectTreeNode {
        name: path
            .file_name()
            .map(|name| name.to_string_lossy().to_string())
            .unwrap_or_else(|| path.display().to_string()),
        path: path.display().to_string(),
        kind,
        children,
        truncated,
    }
}

fn name_for_sort(path: &Path) -> String {
    path.file_name()
        .map(|name| name.to_string_lossy().to_ascii_lowercase())
        .unwrap_or_default()
}

fn detect_package_manager(root: &Path) -> PackageManager {
    if root.join("pnpm-lock.yaml").is_file() {
        PackageManager::Pnpm
    } else if root.join("bun.lockb").is_file() {
        PackageManager::Bun
    } else if root.join("yarn.lock").is_file() {
        PackageManager::Yarn
    } else {
        PackageManager::Npm
    }
}

fn parse_scripts(value: &serde_json::Value) -> Vec<PackageScript> {
    let Some(scripts) = value.get("scripts").and_then(|value| value.as_object()) else {
        return Vec::new();
    };

    let priority = ["dev", "build", "lint", "test"];
    let map: BTreeMap<String, String> = scripts
        .iter()
        .filter_map(|(name, command)| command.as_str().map(|cmd| (name.clone(), cmd.to_string())))
        .collect();

    let mut result = Vec::new();
    for name in priority {
        if let Some(command) = map.get(name) {
            result.push(PackageScript {
                name: name.to_string(),
                command: command.clone(),
            });
        }
    }
    for (name, command) in map {
        if !priority.contains(&name.as_str()) {
            result.push(PackageScript { name, command });
        }
    }
    result
}

#[cfg(test)]
fn shell_quote_word(value: &str) -> String {
    if value
        .chars()
        .all(|c| c.is_ascii_alphanumeric() || matches!(c, '_' | '-' | ':' | '.'))
    {
        value.to_string()
    } else {
        format!("'{}'", value.replace('\'', "'\\''"))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn tree_ignores_heavy_directories() {
        let root = unique_temp_dir("tree");
        fs::create_dir_all(root.join("src")).unwrap();
        fs::create_dir_all(root.join("node_modules/pkg")).unwrap();
        fs::create_dir_all(root.join(".git/objects")).unwrap();
        fs::write(root.join("src/main.ts"), "").unwrap();

        let tree = load_project_tree(root.to_str().unwrap()).unwrap();
        let child_names: Vec<_> = tree
            .root
            .children
            .iter()
            .map(|node| node.name.as_str())
            .collect();

        assert!(child_names.contains(&"src"));
        assert!(!child_names.contains(&"node_modules"));
        assert!(!child_names.contains(&".git"));

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn scripts_detect_package_manager_and_priority_order() {
        let root = unique_temp_dir("scripts");
        fs::create_dir_all(&root).unwrap();
        fs::write(root.join("pnpm-lock.yaml"), "").unwrap();
        fs::write(
            root.join("package.json"),
            r#"{"scripts":{"storybook":"storybook dev","test":"vitest","dev":"vite","build":"vite build"}}"#,
        )
        .unwrap();

        let scripts = load_package_scripts(root.to_str().unwrap()).unwrap();
        let names: Vec<_> = scripts
            .scripts
            .iter()
            .map(|script| script.name.as_str())
            .collect();

        assert_eq!(scripts.package_manager, PackageManager::Pnpm);
        assert_eq!(names, vec!["dev", "build", "test", "storybook"]);
        assert_eq!(
            script_run_command(scripts.package_manager, "dev"),
            "pnpm dev"
        );

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn resolve_project_root_finds_nearest_marker() {
        let outer = unique_temp_dir("root-outer");
        let inner = outer.join("src/sub/deeper");
        fs::create_dir_all(&inner).unwrap();
        fs::write(outer.join("package.json"), "{}").unwrap();

        let resolved = resolve_project_root(inner.to_str().unwrap());
        assert_eq!(resolved.root, outer.to_string_lossy());
        assert_eq!(resolved.marker.as_deref(), Some("package.json"));

        fs::remove_dir_all(outer).unwrap();
    }

    #[test]
    fn resolve_project_root_prefers_lockfile_over_git() {
        let outer = unique_temp_dir("root-prefer");
        let inner = outer.join("apps/web");
        fs::create_dir_all(&inner).unwrap();
        // .git at outer, package.json at inner — inner should win because it's
        // the nearest marker walking upward.
        fs::create_dir_all(outer.join(".git")).unwrap();
        fs::write(inner.join("package.json"), "{}").unwrap();

        let resolved = resolve_project_root(inner.to_str().unwrap());
        assert_eq!(resolved.root, inner.to_string_lossy());
        assert_eq!(resolved.marker.as_deref(), Some("package.json"));

        fs::remove_dir_all(outer).unwrap();
    }

    #[test]
    fn resolve_project_root_falls_back_to_cwd_when_no_marker() {
        let dir = unique_temp_dir("root-fallback");
        fs::create_dir_all(&dir).unwrap();

        let resolved = resolve_project_root(dir.to_str().unwrap());
        assert_eq!(resolved.root, dir.to_string_lossy());
        assert!(resolved.marker.is_none());

        fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn script_run_command_quotes_unusual_names() {
        assert_eq!(
            script_run_command(PackageManager::Npm, "test:unit"),
            "npm run test:unit"
        );
        assert_eq!(
            script_run_command(PackageManager::Yarn, "weird name"),
            "yarn 'weird name'"
        );
    }

    fn unique_temp_dir(label: &str) -> PathBuf {
        let nanos = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        std::env::temp_dir().join(format!("andspace-sidebar-{label}-{nanos}"))
    }
}
