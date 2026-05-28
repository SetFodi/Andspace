use serde::Serialize;
use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};

const MAX_DEPTH: usize = 3;
const MAX_CHILDREN_PER_DIR: usize = 120;
const MAX_TOTAL_NODES: usize = 900;
const IGNORED_DIRS: &[&str] = &[
    "node_modules",
    ".git",
    "dist",
    "build",
    ".next",
    "target",
    "vendor",
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
