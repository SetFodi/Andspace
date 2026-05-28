use serde::Serialize;
use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum RuleMatcher {
    Substring,
    Regex,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum RuleSeverity {
    Confirm,
    TypeToConfirm,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum RuleSource {
    Project,
    User,
    Builtin,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ResolvedRule {
    pub pattern: String,
    pub matcher: RuleMatcher,
    pub source: RuleSource,
    pub severity: Option<RuleSeverity>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ResolvedText {
    pub value: String,
    pub source: RuleSource,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ResolvedRules {
    pub cwd: String,
    pub project_file: Option<String>,
    pub global_file: Option<String>,
    pub protected: Vec<ResolvedRule>,
    pub dangerous: Vec<ResolvedRule>,
    pub allowed: Vec<ResolvedRule>,
    pub ai_handoff: Vec<ResolvedText>,
    pub project_context: Vec<ResolvedText>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct ParsedRule {
    pattern: String,
    matcher: RuleMatcher,
}

#[derive(Debug, Clone, Default, PartialEq, Eq)]
struct ParsedRules {
    protected: Vec<ParsedRule>,
    dangerous: Vec<ParsedRule>,
    allowed: Vec<ParsedRule>,
    ai_handoff: Vec<String>,
    project_context: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Section {
    Protected,
    Dangerous,
    Allowed,
    AiHandoff,
    ProjectContext,
}

#[derive(Debug, Clone)]
struct RuleDocument {
    source: RuleSource,
    path: Option<PathBuf>,
    rules: ParsedRules,
}

pub fn load_rules_for_cwd(cwd: &str) -> Result<ResolvedRules, String> {
    if cwd.trim().is_empty() {
        return Err("cwd is empty".to_string());
    }

    let cwd_path = PathBuf::from(cwd);
    let project_path = cwd_path.join("ANDSPACE.md");
    let global_path = std::env::var("HOME")
        .ok()
        .map(|home| PathBuf::from(home).join(".andspace").join("rules.md"));

    let mut documents = Vec::new();

    if project_path.is_file() {
        documents.push(read_document(RuleSource::Project, project_path)?);
    }

    if let Some(path) = global_path {
        if path.is_file() {
            documents.push(read_document(RuleSource::User, path)?);
        }
    }

    documents.push(RuleDocument {
        source: RuleSource::Builtin,
        path: None,
        rules: builtin_rules(),
    });

    let resolved = resolve_documents(cwd, documents);
    crate::pty::diag_log(&format!(
        "rules-load cwd={} project={} global={} protected={} dangerous={} allowed={}",
        resolved.cwd,
        resolved.project_file.is_some(),
        resolved.global_file.is_some(),
        resolved.protected.len(),
        resolved.dangerous.len(),
        resolved.allowed.len()
    ));

    Ok(resolved)
}

fn read_document(source: RuleSource, path: PathBuf) -> Result<RuleDocument, String> {
    let contents =
        fs::read_to_string(&path).map_err(|e| format!("read {} failed: {e}", path.display()))?;
    Ok(RuleDocument {
        source,
        path: Some(path),
        rules: parse_rules_document(&contents),
    })
}

fn resolve_documents(cwd: &str, documents: Vec<RuleDocument>) -> ResolvedRules {
    let project_file = documents
        .iter()
        .find(|d| d.source == RuleSource::Project)
        .and_then(|d| display_path(d.path.as_deref()));
    let global_file = documents
        .iter()
        .find(|d| d.source == RuleSource::User)
        .and_then(|d| display_path(d.path.as_deref()));

    ResolvedRules {
        cwd: cwd.to_string(),
        project_file,
        global_file,
        protected: merge_rules(
            &documents,
            |rules| &rules.protected,
            Some(RuleSeverity::Confirm),
        ),
        dangerous: merge_rules(
            &documents,
            |rules| &rules.dangerous,
            Some(RuleSeverity::TypeToConfirm),
        ),
        allowed: merge_rules(&documents, |rules| &rules.allowed, None),
        ai_handoff: merge_text(&documents, |rules| &rules.ai_handoff),
        project_context: merge_project_context(&documents),
    }
}

fn display_path(path: Option<&Path>) -> Option<String> {
    path.map(|p| p.display().to_string())
}

fn merge_rules(
    documents: &[RuleDocument],
    select: fn(&ParsedRules) -> &Vec<ParsedRule>,
    severity: Option<RuleSeverity>,
) -> Vec<ResolvedRule> {
    let mut seen = HashSet::new();
    let mut merged = Vec::new();

    for document in documents {
        for rule in select(&document.rules) {
            let key = (rule.matcher, rule.pattern.clone());
            if !seen.insert(key) {
                continue;
            }
            merged.push(ResolvedRule {
                pattern: rule.pattern.clone(),
                matcher: rule.matcher,
                source: document.source,
                severity,
            });
        }
    }

    merged
}

fn merge_text(
    documents: &[RuleDocument],
    select: fn(&ParsedRules) -> &Vec<String>,
) -> Vec<ResolvedText> {
    let mut seen = HashSet::new();
    let mut merged = Vec::new();

    for document in documents {
        for value in select(&document.rules) {
            if !seen.insert(value.clone()) {
                continue;
            }
            merged.push(ResolvedText {
                value: value.clone(),
                source: document.source,
            });
        }
    }

    merged
}

fn merge_project_context(documents: &[RuleDocument]) -> Vec<ResolvedText> {
    documents
        .iter()
        .filter_map(|document| {
            document
                .rules
                .project_context
                .as_ref()
                .map(|value| ResolvedText {
                    value: value.clone(),
                    source: document.source,
                })
        })
        .collect()
}

fn parse_rules_document(markdown: &str) -> ParsedRules {
    let mut rules = ParsedRules::default();
    let mut section = None;
    let mut context_lines = Vec::new();

    for line in markdown.lines() {
        if let Some(next_section) = parse_heading(line) {
            flush_context(&mut rules, &mut context_lines);
            section = next_section;
            continue;
        }

        match section {
            Some(Section::Protected) => {
                if let Some(rule) = parse_rule_list_item(line) {
                    rules.protected.push(rule);
                }
            }
            Some(Section::Dangerous) => {
                if let Some(rule) = parse_rule_list_item(line) {
                    rules.dangerous.push(rule);
                }
            }
            Some(Section::Allowed) => {
                if let Some(rule) = parse_rule_list_item(line) {
                    rules.allowed.push(rule);
                }
            }
            Some(Section::AiHandoff) => {
                if let Some(value) = parse_list_text(line).or_else(|| parse_plain_text(line)) {
                    rules.ai_handoff.push(value);
                }
            }
            Some(Section::ProjectContext) => {
                let value = line.trim();
                if !value.is_empty() {
                    context_lines.push(value.to_string());
                }
            }
            None => {}
        }
    }

    flush_context(&mut rules, &mut context_lines);
    rules
}

fn parse_heading(line: &str) -> Option<Option<Section>> {
    let trimmed = line.trim_start();
    let level = trimmed.chars().take_while(|c| *c == '#').count();
    if level != 2 {
        return None;
    }

    let title = trimmed[level..]
        .trim()
        .trim_end_matches('#')
        .trim()
        .to_ascii_lowercase();

    let section = match title.as_str() {
        "protected commands" => Some(Section::Protected),
        "dangerous commands" => Some(Section::Dangerous),
        "allowed" => Some(Section::Allowed),
        "ai handoff" => Some(Section::AiHandoff),
        "project context" => Some(Section::ProjectContext),
        _ => None,
    };

    Some(section)
}

fn parse_rule_list_item(line: &str) -> Option<ParsedRule> {
    let value = parse_list_text(line)?;
    if value.starts_with('/') && value.ends_with('/') && value.len() > 2 {
        Some(ParsedRule {
            pattern: value[1..value.len() - 1].to_string(),
            matcher: RuleMatcher::Regex,
        })
    } else {
        Some(ParsedRule {
            pattern: value,
            matcher: RuleMatcher::Substring,
        })
    }
}

fn parse_list_text(line: &str) -> Option<String> {
    let trimmed = line.trim_start();
    let rest = trimmed
        .strip_prefix("- ")
        .or_else(|| trimmed.strip_prefix("* "))
        .or_else(|| trimmed.strip_prefix("+ "))?;
    parse_plain_text(rest)
}

fn parse_plain_text(line: &str) -> Option<String> {
    let value = strip_inline_comment(line).trim();
    if value.is_empty() {
        None
    } else {
        Some(value.to_string())
    }
}

fn strip_inline_comment(line: &str) -> &str {
    line.split_once('#')
        .map(|(before, _)| before)
        .unwrap_or(line)
}

fn flush_context(rules: &mut ParsedRules, context_lines: &mut Vec<String>) {
    if !context_lines.is_empty() {
        rules.project_context = Some(context_lines.join("\n"));
        context_lines.clear();
    }
}

fn builtin_rules() -> ParsedRules {
    ParsedRules {
        protected: [
            "git push --force",
            "git push -f",
            "sudo",
            "npm publish",
            "pnpm publish",
            "yarn publish",
            "vercel --prod",
            "supabase db push",
            "pm2 restart",
        ]
        .into_iter()
        .map(substring_rule)
        .collect(),
        dangerous: ["rm -rf /", "DROP TABLE", "dropdb"]
            .into_iter()
            .map(substring_rule)
            .collect(),
        allowed: Vec::new(),
        ai_handoff: Vec::new(),
        project_context: None,
    }
}

fn substring_rule(pattern: &str) -> ParsedRule {
    ParsedRule {
        pattern: pattern.to_string(),
        matcher: RuleMatcher::Substring,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_recognized_sections_and_ignores_unknown_sections() {
        let parsed = parse_rules_document(
            r#"
## Protected Commands
- git push origin main # deployment
- /kubectl\s+delete/

## Unknown
- ignored

## dangerous commands
* DROP DATABASE

## Allowed
+ git push origin main

## AI Handoff
- include cwd and last command

## Project Context
AndSpace is a workflow terminal.
Keep Command Guard UI out of this milestone.
"#,
        );

        assert_eq!(parsed.protected.len(), 2);
        assert_eq!(parsed.protected[0].pattern, "git push origin main");
        assert_eq!(parsed.protected[0].matcher, RuleMatcher::Substring);
        assert_eq!(parsed.protected[1].pattern, r"kubectl\s+delete");
        assert_eq!(parsed.protected[1].matcher, RuleMatcher::Regex);
        assert_eq!(parsed.dangerous[0].pattern, "DROP DATABASE");
        assert_eq!(parsed.allowed[0].pattern, "git push origin main");
        assert_eq!(parsed.ai_handoff[0], "include cwd and last command");
        assert_eq!(
            parsed.project_context.as_deref(),
            Some("AndSpace is a workflow terminal.\nKeep Command Guard UI out of this milestone.")
        );
    }

    #[test]
    fn precedence_keeps_highest_source_for_duplicate_rules() {
        let mut project = ParsedRules::default();
        project.protected.push(substring_rule("sudo"));

        let mut user = ParsedRules::default();
        user.protected.push(substring_rule("sudo"));
        user.protected.push(substring_rule("git push --force"));
        user.dangerous.push(substring_rule("dropdb"));

        let resolved = resolve_documents(
            "/workspace",
            vec![
                RuleDocument {
                    source: RuleSource::Project,
                    path: Some(PathBuf::from("/workspace/ANDSPACE.md")),
                    rules: project,
                },
                RuleDocument {
                    source: RuleSource::User,
                    path: Some(PathBuf::from("/home/me/.andspace/rules.md")),
                    rules: user,
                },
                RuleDocument {
                    source: RuleSource::Builtin,
                    path: None,
                    rules: builtin_rules(),
                },
            ],
        );

        let sudo = resolved
            .protected
            .iter()
            .find(|rule| rule.pattern == "sudo")
            .unwrap();
        let force_push = resolved
            .protected
            .iter()
            .find(|rule| rule.pattern == "git push --force")
            .unwrap();
        let dropdb = resolved
            .dangerous
            .iter()
            .find(|rule| rule.pattern == "dropdb")
            .unwrap();

        assert_eq!(sudo.source, RuleSource::Project);
        assert_eq!(force_push.source, RuleSource::User);
        assert_eq!(dropdb.source, RuleSource::User);
        assert_eq!(resolved.protected[0].pattern, "sudo");
    }

    #[test]
    fn builtin_defaults_are_present() {
        let resolved = resolve_documents(
            "/workspace",
            vec![RuleDocument {
                source: RuleSource::Builtin,
                path: None,
                rules: builtin_rules(),
            }],
        );

        assert!(resolved
            .protected
            .iter()
            .any(|rule| rule.pattern == "git push --force"));
        assert!(resolved
            .dangerous
            .iter()
            .any(|rule| rule.pattern == "rm -rf /"));
    }

    #[test]
    fn load_rules_for_cwd_reads_project_and_global_files() {
        let root = unique_temp_dir("load");
        let project = root.join("project");
        let home = root.join("home");
        let global_dir = home.join(".andspace");
        fs::create_dir_all(&project).unwrap();
        fs::create_dir_all(&global_dir).unwrap();
        fs::write(
            project.join("ANDSPACE.md"),
            r#"
## Protected Commands
- sudo

## Dangerous Commands
- DROP TABLE

## Allowed
- sudo make install

## AI Handoff
- include cwd and last command

## Project Context
Temporary project context.
"#,
        )
        .unwrap();
        fs::write(
            global_dir.join("rules.md"),
            r#"
## Protected Commands
- sudo
- npm publish

## Dangerous Commands
- dropdb
"#,
        )
        .unwrap();

        let previous_home = std::env::var_os("HOME");
        std::env::set_var("HOME", &home);
        let resolved = load_rules_for_cwd(project.to_str().unwrap()).unwrap();
        restore_home(previous_home);
        fs::remove_dir_all(&root).unwrap();

        let sudo = resolved
            .protected
            .iter()
            .find(|rule| rule.pattern == "sudo")
            .unwrap();
        let npm_publish = resolved
            .protected
            .iter()
            .find(|rule| rule.pattern == "npm publish")
            .unwrap();

        assert!(resolved.project_file.is_some());
        assert!(resolved.global_file.is_some());
        assert_eq!(sudo.source, RuleSource::Project);
        assert_eq!(npm_publish.source, RuleSource::User);
        assert!(resolved
            .protected
            .iter()
            .any(|rule| rule.pattern == "git push --force"));
        assert!(resolved
            .dangerous
            .iter()
            .any(|rule| rule.pattern == "DROP TABLE" && rule.source == RuleSource::Project));
        assert!(resolved
            .dangerous
            .iter()
            .any(|rule| rule.pattern == "dropdb" && rule.source == RuleSource::User));
        assert_eq!(resolved.allowed[0].pattern, "sudo make install");
        assert_eq!(resolved.ai_handoff[0].value, "include cwd and last command");
        assert_eq!(
            resolved.project_context[0].value,
            "Temporary project context."
        );
    }

    fn unique_temp_dir(label: &str) -> PathBuf {
        let nanos = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        std::env::temp_dir().join(format!("andspace-rules-{label}-{nanos}"))
    }

    fn restore_home(previous_home: Option<std::ffi::OsString>) {
        if let Some(value) = previous_home {
            std::env::set_var("HOME", value);
        } else {
            std::env::remove_var("HOME");
        }
    }
}
