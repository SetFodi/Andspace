import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  detectAiCliTools,
  type AiCliTarget,
  type AiCliTool,
} from "./aiHandoff";
import type { AvailableEditors } from "./fileActions";
import type {
  DefaultAiCli,
  DefaultFileAction,
  Preferences,
  ScrollbackProfile,
  ShellProfile,
} from "./preferencesModel";
import { THEME_PRESETS } from "./preferencesModel";
import {
  detectShellSetup,
  installRecommendedShellTools,
  shortShellPath,
  type ShellSetupStatus,
} from "./shellSetup";
import { CheckMark, ThemeCard } from "./ThemeCard";
import { sendTestNotification } from "./commandNotifications";

interface Props {
  open: boolean;
  mode: "onboarding" | "preferences";
  preferences: Preferences;
  editors: AvailableEditors;
  onSave: (preferences: Preferences) => Promise<void>;
  onClose: () => void;
}

const SCROLLBACK: Array<{
  value: ScrollbackProfile;
  title: string;
  description: string;
}> = [
  {
    value: "balanced",
    title: "Balanced",
    description: "5k lines, the default for daily local dev.",
  },
  {
    value: "memory-saver",
    title: "Memory saver",
    description: "1k lines for lower memory use.",
  },
  {
    value: "long-history",
    title: "Long history",
    description: "15k lines for deeper scrollback.",
  },
];

const FILE_ACTIONS: Array<{
  value: DefaultFileAction;
  title: string;
  description: string;
}> = [
  { value: "auto", title: "Auto-detect", description: "Cursor, VS Code, Neovim, then copy." },
  { value: "cursor", title: "Cursor", description: "Open files in Cursor when available." },
  { value: "code", title: "VS Code", description: "Open files with the code CLI." },
  { value: "nvim-split", title: "Neovim split", description: "Open inside a terminal split." },
  { value: "copy", title: "Copy path", description: "Keep file actions passive by default." },
];

const AI_TARGETS: Array<{
  value: DefaultAiCli;
  target?: AiCliTarget;
  title: string;
  description: string;
}> = [
  { value: "ask", title: "Ask every time", description: "Keep all local CLI buttons visible." },
  { value: "claude", target: "claude", title: "Claude", description: "Prefer Claude Code." },
  { value: "codex", target: "codex", title: "Codex", description: "Prefer Codex CLI." },
  { value: "cursor", target: "cursor", title: "Cursor CLI", description: "Prefer Cursor's CLI." },
];

const SHELL_PROFILES: Array<{
  value: ShellProfile;
  title: string;
  description: string;
}> = [
  {
    value: "managed-zsh",
    title: "Managed zsh profile",
    description: "Recommended. Clean AndSpace-owned zsh setup; no edits to your dotfiles.",
  },
  {
    value: "user-shell",
    title: "Use my shell config",
    description: "Use your existing $SHELL and dotfiles. Best for customized setups.",
  },
  {
    value: "custom",
    title: "Custom shell path",
    description: "Point AndSpace at a specific shell executable.",
  },
];

export function PreferencesOverlay({
  open,
  mode,
  preferences,
  editors,
  onSave,
  onClose,
}: Props) {
  const [draft, setDraft] = useState(preferences);
  const [saving, setSaving] = useState(false);
  const [aiTools, setAiTools] = useState<AiCliTool[]>([]);
  const [shellStatus, setShellStatus] = useState<ShellSetupStatus | null>(null);
  const [shellError, setShellError] = useState<string | null>(null);
  const [installingShellTools, setInstallingShellTools] = useState(false);
  const [notifyTest, setNotifyTest] = useState<
    "idle" | "sending" | "sent" | "denied" | "error"
  >("idle");
  const rootRef = useRef<HTMLDivElement>(null);
  const isOnboarding = mode === "onboarding";

  useEffect(() => {
    if (open) setDraft(preferences);
  }, [open, preferences]);

  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => rootRef.current?.focus());
    detectAiCliTools()
      .then(setAiTools)
      .catch(() => setAiTools([]));
    detectShellSetup()
      .then((status) => {
        setShellStatus(status);
        setShellError(null);
      })
      .catch((e) => {
        setShellStatus(null);
        setShellError(String(e));
      });

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isOnboarding) {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener("keydown", onKeyDown, true);
    };
  }, [isOnboarding, onClose, open]);

  const toolAvailability = useMemo(() => {
    const map: Partial<Record<AiCliTarget, AiCliTool>> = {};
    for (const tool of aiTools) map[tool.target] = tool;
    return map;
  }, [aiTools]);

  if (!open) return null;

  const installTools = async () => {
    setInstallingShellTools(true);
    setShellError(null);
    try {
      const status = await installRecommendedShellTools();
      setShellStatus(status);
    } catch (e) {
      setShellError(String(e));
    } finally {
      setInstallingShellTools(false);
    }
  };

  const save = async (completed: boolean) => {
    setSaving(true);
    try {
      await onSave({
        ...draft,
        onboardingCompleted: completed ? true : draft.onboardingCompleted,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      ref={rootRef}
      tabIndex={-1}
      className="preferences-overlay"
      role="presentation"
      onMouseDown={(e) => {
        if (!isOnboarding && e.target === e.currentTarget) onClose();
      }}
    >
      <section
        className="preferences-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="preferences-title"
        onKeyDown={(e) => e.stopPropagation()}
      >
        <div className="preferences-head">
          <div>
            <div className="preferences-kicker">
              <span className="kicker-dot" aria-hidden />
              {isOnboarding ? "FIRST RUN" : "PREFERENCES"}
            </div>
            <h2 id="preferences-title">
              {isOnboarding ? "Welcome to AndSpace" : "AndSpace preferences"}
            </h2>
            <p>
              A macOS terminal built around your local development workflow.
              No account, no telemetry, local CLIs only.
            </p>
          </div>
          {!isOnboarding && (
            <button
              className="preferences-close"
              onClick={onClose}
              aria-label="Close preferences"
            >
              <svg viewBox="0 0 16 16" aria-hidden>
                <path d="M4 4l8 8M12 4l-8 8" />
              </svg>
            </button>
          )}
        </div>

        <div className="preferences-body">
          <PreferenceSection
            eyebrow="Theme"
            title="Choose the terminal tone"
            description="These themes keep the same layout and only tune the app chrome and terminal surface."
          >
            <div className="preferences-card-grid theme-grid">
              {THEME_PRESETS.map((theme) => (
                <ThemeCard
                  key={theme.value}
                  preset={theme}
                  selected={draft.theme === theme.value}
                  onClick={() => setDraft({ ...draft, theme: theme.value })}
                />
              ))}
            </div>
          </PreferenceSection>

          <PreferenceSection
            eyebrow="Terminal"
            title="Tune terminal density"
            description="Scrollback sets retained in-session history. It is never written to persisted app state."
          >
            <div className="density-control">
              <div className="density-control-label">
                <strong>Font size</strong>
                <em>Applies immediately to every pane.</em>
              </div>
              <div className="font-size-row">
                <button
                  aria-label="Decrease font size"
                  disabled={draft.terminal.fontSize <= 11}
                  onClick={() => setDraft({
                    ...draft,
                    terminal: {
                      ...draft.terminal,
                      fontSize: Math.max(11, draft.terminal.fontSize - 1),
                    },
                  })}
                >
                  −
                </button>
                <strong>{draft.terminal.fontSize}px</strong>
                <button
                  aria-label="Increase font size"
                  disabled={draft.terminal.fontSize >= 18}
                  onClick={() => setDraft({
                    ...draft,
                    terminal: {
                      ...draft.terminal,
                      fontSize: Math.min(18, draft.terminal.fontSize + 1),
                    },
                  })}
                >
                  +
                </button>
              </div>
            </div>
            <div className="density-sublabel">Scrollback history</div>
            <div className="preferences-card-grid three">
              {SCROLLBACK.map((profile) => (
                <RadioCard
                  key={profile.value}
                  title={profile.title}
                  description={profile.description}
                  selected={draft.terminal.scrollbackProfile === profile.value}
                  onClick={() =>
                    setDraft({
                      ...draft,
                      terminal: {
                        ...draft.terminal,
                        scrollbackProfile: profile.value,
                      },
                    })
                  }
                />
              ))}
            </div>
          </PreferenceSection>

          <PreferenceSection
            eyebrow="Shell"
            title="Choose how panes start"
            description="Managed zsh gives new users a clean setup without copying your personal dotfiles. Existing config keeps today's behavior."
          >
            <div className="preferences-card-grid three shell-profile-grid">
              {SHELL_PROFILES.map((profile) => (
                <RadioCard
                  key={profile.value}
                  title={profile.title}
                  description={shellProfileDescription(profile, shellStatus)}
                  selected={draft.shell.profile === profile.value}
                  onClick={() =>
                    setDraft({
                      ...draft,
                      shell: {
                        ...draft.shell,
                        profile: profile.value,
                      },
                    })
                  }
                />
              ))}
            </div>

            {draft.shell.profile === "custom" && (
              <label className="shell-custom-path">
                <span>Shell executable</span>
                <input
                  value={draft.shell.customPath ?? ""}
                  placeholder="/bin/zsh"
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      shell: {
                        ...draft.shell,
                        customPath: e.target.value || null,
                      },
                    })
                  }
                />
              </label>
            )}

            {draft.shell.profile === "managed-zsh" && (
              <ShellToolsPanel
                status={shellStatus}
                error={shellError}
                installing={installingShellTools}
                onInstall={() => void installTools()}
              />
            )}
          </PreferenceSection>

          <PreferenceSection
            eyebrow="Workflow"
            title="Pick default local actions"
            description="Defaults only choose which existing local tool AndSpace prefers. They do not add provider APIs or cloud accounts."
          >
            <div className="preferences-split-grid">
              <div>
                <h3>Default file action</h3>
                <div className="preferences-option-list">
                  {FILE_ACTIONS.map((action) => (
                    <RadioRow
                      key={action.value}
                      title={action.title}
                      description={fileActionDescription(action.value, action.description, editors)}
                      selected={draft.workflow.defaultFileAction === action.value}
                      onClick={() =>
                        setDraft({
                          ...draft,
                          workflow: {
                            ...draft.workflow,
                            defaultFileAction: action.value,
                          },
                        })
                      }
                    />
                  ))}
                </div>
              </div>
              <div>
                <h3>Default AI CLI</h3>
                <div className="preferences-option-list">
                  {AI_TARGETS.map((target) => (
                    <RadioRow
                      key={target.value}
                      title={target.title}
                      description={aiDescription(target, toolAvailability)}
                      selected={draft.workflow.defaultAiCli === target.value}
                      onClick={() =>
                        setDraft({
                          ...draft,
                          workflow: {
                            ...draft.workflow,
                            defaultAiCli: target.value,
                          },
                        })
                      }
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="server-behavior-block">
              <h3>Server links</h3>
              <ToggleRow
                title="Open server rows in external browser"
                description="Off by default. Terminal links still use ⌘Click for preview and ⇧⌘Click for browser."
                checked={draft.workflow.serverOpenBehavior === "external"}
                onChange={(checked) =>
                  setDraft({
                    ...draft,
                    workflow: {
                      ...draft.workflow,
                      serverOpenBehavior: checked ? "external" : "preview",
                    },
                  })
                }
              />
            </div>
          </PreferenceSection>

          <PreferenceSection
            eyebrow="Safety"
            title="Keep the daily-driver guardrails"
            description="AndSpace restores layout and cwd, not terminal output, AI prompts, secrets, or shell history."
          >
            <div className="preferences-toggle-list">
              <ToggleRow
                title="Command Guard"
                description="Enabled by default. Existing zsh panes read this local preference before each command."
                checked={draft.safety.commandGuardEnabled}
                onChange={(checked) =>
                  setDraft({
                    ...draft,
                    safety: {
                      ...draft.safety,
                      commandGuardEnabled: checked,
                    },
                  })
                }
              />
              <ToggleRow
                title="Workspace restore"
                description="Restore tabs, splits, cwd, sidebar state, and window shape on launch."
                checked={draft.safety.workspaceRestoreEnabled}
                onChange={(checked) =>
                  setDraft({
                    ...draft,
                    safety: {
                      ...draft.safety,
                      workspaceRestoreEnabled: checked,
                    },
                  })
                }
              />
            </div>
          </PreferenceSection>

          <PreferenceSection
            eyebrow="Notifications"
            title="Get pinged when long commands finish"
            description="Fires a macOS notification when a command — or a handed-off AI CLI — finishes while AndSpace is in the background and ran longer than 30 seconds."
          >
            <div className="preferences-toggle-list">
              <ToggleRow
                title="Command finish notifications"
                description="Only fires when the window is unfocused. macOS may ask for notification permission the first time."
                checked={draft.notifications.commandFinish}
                onChange={(checked) =>
                  setDraft({
                    ...draft,
                    notifications: {
                      ...draft.notifications,
                      commandFinish: checked,
                    },
                  })
                }
              />
            </div>
            <div className="preferences-notify-test">
              <button
                type="button"
                className="preferences-button ghost"
                disabled={notifyTest === "sending"}
                onClick={async () => {
                  setNotifyTest("sending");
                  setNotifyTest(await sendTestNotification());
                }}
              >
                {notifyTest === "sending"
                  ? "Sending…"
                  : "Send a test notification"}
              </button>
              {notifyTest !== "idle" && notifyTest !== "sending" ? (
                <span className="preferences-notify-test-status">
                  {notifyTest === "sent"
                    ? "Sent — check Notification Center."
                    : notifyTest === "denied"
                      ? "Blocked. Allow AndSpace in System Settings → Notifications."
                      : "Couldn't send — notifications need the installed app, not dev mode."}
                </span>
              ) : null}
            </div>
          </PreferenceSection>
        </div>

        <div className="preferences-footer">
          <div>
            {isOnboarding
              ? "Preferences are stored locally in Application Support."
              : "Press Esc to close without saving changes."}
          </div>
          <div className="preferences-footer-actions">
            {!isOnboarding && (
              <button className="preferences-button ghost" onClick={onClose}>
                Cancel
              </button>
            )}
            <button
              className="preferences-button primary"
              disabled={saving}
              onClick={() => save(isOnboarding || draft.onboardingCompleted)}
            >
              {saving
                ? "Saving"
                : isOnboarding
                  ? "Start using AndSpace"
                  : "Save preferences"}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function PreferenceSection({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="preferences-section">
      <div className="preferences-section-head">
        <span>{eyebrow}</span>
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
      {children}
    </section>
  );
}

function RadioCard({
  title,
  description,
  selected,
  onClick,
}: {
  title: string;
  description: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`preferences-choice-card ${selected ? "selected" : ""}`}
      onClick={onClick}
    >
      <span className="choice-check" aria-hidden>
        <CheckMark />
      </span>
      <strong>{title}</strong>
      <em>{description}</em>
    </button>
  );
}

function RadioRow({
  title,
  description,
  selected,
  onClick,
}: {
  title: string;
  description: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`preferences-row-option ${selected ? "selected" : ""}`}
      onClick={onClick}
    >
      <span className="choice-dot" aria-hidden />
      <span>
        <strong>{title}</strong>
        <em>{description}</em>
      </span>
    </button>
  );
}

function ToggleRow({
  title,
  description,
  checked,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      className={`preferences-toggle ${checked ? "checked" : ""}`}
      onClick={() => onChange(!checked)}
    >
      <span>
        <strong>{title}</strong>
        <em>{description}</em>
      </span>
      <span className="toggle-track" aria-hidden>
        <span className="toggle-thumb" />
      </span>
    </button>
  );
}

function ShellToolsPanel({
  status,
  error,
  installing,
  onInstall,
}: {
  status: ShellSetupStatus | null;
  error: string | null;
  installing: boolean;
  onInstall: () => void;
}) {
  const tools = status?.tools ?? [];
  const missing = tools.filter((tool) => !tool.installed);

  return (
    <div className="shell-tools-panel">
      <div className="shell-tools-head">
        <div>
          <strong>Recommended shell tools</strong>
          <em>
            AndSpace enables these only when installed. It never edits your
            personal dotfiles.
          </em>
        </div>
        <button
          type="button"
          className="preferences-button ghost shell-install-button"
          disabled={!status?.homebrewPath || missing.length === 0 || installing}
          onClick={onInstall}
        >
          {installing
            ? "Installing"
            : missing.length === 0
              ? "All installed"
              : "Install missing"}
        </button>
      </div>
      {!status?.homebrewPath && (
        <div className="shell-tools-note">
          Homebrew was not detected. Install Homebrew first to install the
          recommended tools from AndSpace.
        </div>
      )}
      {error && <div className="shell-tools-error">{error}</div>}
      <div className="shell-tool-list">
        {tools.length === 0 ? (
          <div className="shell-tools-note">Checking local tools...</div>
        ) : (
          tools.map((tool) => (
            <div
              key={tool.id}
              className={`shell-tool-row ${tool.installed ? "installed" : ""}`}
            >
              <span className="shell-tool-dot" aria-hidden />
              <span>
                <strong>{tool.title}</strong>
                <em>{tool.description}</em>
              </span>
              <code>{tool.installed ? "installed" : tool.package}</code>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function shellProfileDescription(
  profile: { value: ShellProfile; description: string },
  status: ShellSetupStatus | null
): string {
  if (profile.value === "managed-zsh" && status) {
    return `Recommended. Starts ${shortShellPath(status.managedShell)} with AndSpace's clean zsh profile.`;
  }
  if (profile.value === "user-shell" && status) {
    return `Use ${shortShellPath(status.userShell)} and your existing dotfiles.`;
  }
  return profile.description;
}

function fileActionDescription(
  action: DefaultFileAction,
  fallback: string,
  editors: AvailableEditors
): string {
  if (action === "cursor" && !editors.cursor) return "Cursor CLI not detected now.";
  if (action === "code" && !editors.code) return "VS Code code CLI not detected now.";
  if (action === "nvim-split" && !editors.nvim) return "Neovim not detected now.";
  return fallback;
}

function aiDescription(
  target: {
    value: DefaultAiCli;
    target?: AiCliTarget;
    description: string;
  },
  tools: Partial<Record<AiCliTarget, AiCliTool>>
): string {
  if (!target.target) return target.description;
  const tool = tools[target.target];
  if (!tool) return `${target.description} Detection pending.`;
  return tool.available
    ? `${target.description} Detected locally.`
    : `${target.description} Not detected now.`;
}
