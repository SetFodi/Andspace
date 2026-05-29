export const PREFERENCES_VERSION = 1;

export type ThemePreference =
  | "graphite-violet"
  | "midnight"
  | "pure-dark"
  | "soft-contrast";

export type ScrollbackProfile = "memory-saver" | "balanced" | "long-history";

export type DefaultFileAction =
  | "auto"
  | "cursor"
  | "code"
  | "nvim-split"
  | "copy";

export type DefaultAiCli = "ask" | "claude" | "codex" | "cursor";

export type ServerOpenBehavior = "external" | "preview" | "ask";

export interface TerminalPreferences {
  fontSize: number;
  scrollbackProfile: ScrollbackProfile;
}

export interface WorkflowPreferences {
  defaultFileAction: DefaultFileAction;
  defaultAiCli: DefaultAiCli;
  serverOpenBehavior: ServerOpenBehavior;
}

export interface SafetyPreferences {
  workspaceRestoreEnabled: boolean;
  commandGuardEnabled: boolean;
}

export interface Preferences {
  version: number;
  savedAt: number | null;
  onboardingCompleted: boolean;
  theme: ThemePreference;
  terminal: TerminalPreferences;
  workflow: WorkflowPreferences;
  safety: SafetyPreferences;
}

export const DEFAULT_PREFERENCES: Preferences = {
  version: PREFERENCES_VERSION,
  savedAt: null,
  onboardingCompleted: false,
  theme: "graphite-violet",
  terminal: {
    fontSize: 13,
    scrollbackProfile: "balanced",
  },
  workflow: {
    defaultFileAction: "auto",
    defaultAiCli: "ask",
    serverOpenBehavior: "external",
  },
  safety: {
    workspaceRestoreEnabled: true,
    commandGuardEnabled: true,
  },
};

export function normalizePreferences(raw: unknown): Preferences {
  if (!raw || typeof raw !== "object") return cloneDefaultPreferences();
  const value = raw as Partial<Preferences>;

  return {
    version:
      typeof value.version === "number" ? value.version : PREFERENCES_VERSION,
    savedAt: typeof value.savedAt === "number" ? value.savedAt : null,
    onboardingCompleted: value.onboardingCompleted === true,
    theme: normalizeTheme(value.theme),
    terminal: normalizeTerminalPreferences(value.terminal),
    workflow: normalizeWorkflowPreferences(value.workflow),
    safety: normalizeSafetyPreferences(value.safety),
  };
}

export function cloneDefaultPreferences(): Preferences {
  return {
    ...DEFAULT_PREFERENCES,
    terminal: { ...DEFAULT_PREFERENCES.terminal },
    workflow: { ...DEFAULT_PREFERENCES.workflow },
    safety: { ...DEFAULT_PREFERENCES.safety },
  };
}

export function scrollbackRowsForProfile(profile: ScrollbackProfile): number {
  if (profile === "memory-saver") return 1000;
  if (profile === "long-history") return 15000;
  return 5000;
}

export function clampTerminalFontSize(fontSize: unknown): number {
  if (typeof fontSize !== "number" || Number.isNaN(fontSize)) {
    return DEFAULT_PREFERENCES.terminal.fontSize;
  }
  return Math.min(18, Math.max(11, Math.round(fontSize)));
}

export function xtermThemeForPreference(theme: ThemePreference) {
  if (theme === "midnight") {
    return {
      background: "#080b14",
      foreground: "#e7edf7",
      cursor: "#60a5fa",
      cursorAccent: "#080b14",
      selectionBackground: "#26425f",
      selectionInactiveBackground: "#1b2b3d",
    };
  }
  if (theme === "pure-dark") {
    return {
      background: "#050506",
      foreground: "#f0f0f2",
      cursor: "#d4d4d8",
      cursorAccent: "#050506",
      selectionBackground: "#3f3f46",
      selectionInactiveBackground: "#27272a",
    };
  }
  if (theme === "soft-contrast") {
    return {
      background: "#111111",
      foreground: "#f4f1ea",
      cursor: "#f59e0b",
      cursorAccent: "#111111",
      selectionBackground: "#4a3824",
      selectionInactiveBackground: "#33281d",
    };
  }
  return {
    background: "#0d0e12",
    foreground: "#e6e6ea",
    cursor: "#a78bfa",
    cursorAccent: "#0d0e12",
    selectionBackground: "#4a3d72",
    selectionInactiveBackground: "#322c46",
  };
}

function normalizeTerminalPreferences(value: unknown): TerminalPreferences {
  if (!value || typeof value !== "object") {
    return { ...DEFAULT_PREFERENCES.terminal };
  }
  const terminal = value as Partial<TerminalPreferences>;
  return {
    fontSize: clampTerminalFontSize(terminal.fontSize),
    scrollbackProfile: normalizeScrollbackProfile(terminal.scrollbackProfile),
  };
}

function normalizeWorkflowPreferences(value: unknown): WorkflowPreferences {
  if (!value || typeof value !== "object") {
    return { ...DEFAULT_PREFERENCES.workflow };
  }
  const workflow = value as Partial<WorkflowPreferences>;
  return {
    defaultFileAction: normalizeDefaultFileAction(workflow.defaultFileAction),
    defaultAiCli: normalizeDefaultAiCli(workflow.defaultAiCli),
    serverOpenBehavior: normalizeServerOpenBehavior(workflow.serverOpenBehavior),
  };
}

function normalizeSafetyPreferences(value: unknown): SafetyPreferences {
  if (!value || typeof value !== "object") {
    return { ...DEFAULT_PREFERENCES.safety };
  }
  const safety = value as Partial<SafetyPreferences>;
  return {
    workspaceRestoreEnabled: safety.workspaceRestoreEnabled !== false,
    commandGuardEnabled: safety.commandGuardEnabled !== false,
  };
}

function normalizeTheme(value: unknown): ThemePreference {
  return value === "midnight" ||
    value === "pure-dark" ||
    value === "soft-contrast" ||
    value === "graphite-violet"
    ? value
    : DEFAULT_PREFERENCES.theme;
}

function normalizeScrollbackProfile(value: unknown): ScrollbackProfile {
  return value === "memory-saver" ||
    value === "long-history" ||
    value === "balanced"
    ? value
    : DEFAULT_PREFERENCES.terminal.scrollbackProfile;
}

function normalizeDefaultFileAction(value: unknown): DefaultFileAction {
  return value === "cursor" ||
    value === "code" ||
    value === "nvim-split" ||
    value === "copy" ||
    value === "auto"
    ? value
    : DEFAULT_PREFERENCES.workflow.defaultFileAction;
}

function normalizeDefaultAiCli(value: unknown): DefaultAiCli {
  return value === "claude" || value === "codex" || value === "cursor" || value === "ask"
    ? value
    : DEFAULT_PREFERENCES.workflow.defaultAiCli;
}

function normalizeServerOpenBehavior(value: unknown): ServerOpenBehavior {
  return value === "preview" || value === "ask" || value === "external"
    ? value
    : DEFAULT_PREFERENCES.workflow.serverOpenBehavior;
}
