export const PREFERENCES_VERSION = 1;

export const THEME_PRESET_VALUES = [
  "graphite-violet",
  "midnight",
  "pure-dark",
  "soft-contrast",
  "cobalt",
  "evergreen",
  "rose-noir",
  "ember",
  "aurora",
  "slate-lime",
] as const;

export type ThemePreference = (typeof THEME_PRESET_VALUES)[number];

export interface ThemePreset {
  value: ThemePreference;
  title: string;
  description: string;
  css: {
    appBg: string;
    chromeBg: string;
    terminalBg: string;
    surface: string;
    accent: string;
    accentSoft: string;
    activeBorder: string;
  };
  xterm: {
    background: string;
    foreground: string;
    cursor: string;
    cursorAccent: string;
    selectionBackground: string;
    selectionInactiveBackground: string;
  };
}

export const THEME_PRESETS: ThemePreset[] = [
  {
    value: "graphite-violet",
    title: "Graphite Violet",
    description: "Default AndSpace contrast with violet focus accents.",
    css: {
      appBg: "#0a0a0c",
      chromeBg: "#0a0a0c",
      terminalBg: "#0d0e12",
      surface: "#101116",
      accent: "#a78bfa",
      accentSoft: "rgba(167, 139, 250, 0.14)",
      activeBorder: "rgba(167, 139, 250, 0.55)",
    },
    xterm: {
      background: "#0d0e12",
      foreground: "#e6e6ea",
      cursor: "#a78bfa",
      cursorAccent: "#0d0e12",
      selectionBackground: "#4a3d72",
      selectionInactiveBackground: "#322c46",
    },
  },
  {
    value: "midnight",
    title: "Midnight",
    description: "Cooler blue-black tone for long night sessions.",
    css: {
      appBg: "#060914",
      chromeBg: "#070a12",
      terminalBg: "#080b14",
      surface: "#0d1320",
      accent: "#60a5fa",
      accentSoft: "rgba(96, 165, 250, 0.13)",
      activeBorder: "rgba(96, 165, 250, 0.5)",
    },
    xterm: {
      background: "#080b14",
      foreground: "#e7edf7",
      cursor: "#60a5fa",
      cursorAccent: "#080b14",
      selectionBackground: "#26425f",
      selectionInactiveBackground: "#1b2b3d",
    },
  },
  {
    value: "pure-dark",
    title: "Pure Dark",
    description: "Lowest-chrome, high-neutral terminal surface.",
    css: {
      appBg: "#050506",
      chromeBg: "#050506",
      terminalBg: "#050506",
      surface: "#0b0b0d",
      accent: "#d4d4d8",
      accentSoft: "rgba(212, 212, 216, 0.1)",
      activeBorder: "rgba(212, 212, 216, 0.42)",
    },
    xterm: {
      background: "#050506",
      foreground: "#f0f0f2",
      cursor: "#d4d4d8",
      cursorAccent: "#050506",
      selectionBackground: "#3f3f46",
      selectionInactiveBackground: "#27272a",
    },
  },
  {
    value: "soft-contrast",
    title: "Soft Contrast",
    description: "Warmer text and softer amber focus color.",
    css: {
      appBg: "#0d0c0a",
      chromeBg: "#0d0c0a",
      terminalBg: "#111111",
      surface: "#15120e",
      accent: "#f59e0b",
      accentSoft: "rgba(245, 158, 11, 0.13)",
      activeBorder: "rgba(245, 158, 11, 0.48)",
    },
    xterm: {
      background: "#111111",
      foreground: "#f4f1ea",
      cursor: "#f59e0b",
      cursorAccent: "#111111",
      selectionBackground: "#4a3824",
      selectionInactiveBackground: "#33281d",
    },
  },
  {
    value: "cobalt",
    title: "Cobalt",
    description: "Saturated blue focus without bright editor chrome.",
    css: {
      appBg: "#070b18",
      chromeBg: "#080d1a",
      terminalBg: "#09111f",
      surface: "#101a2e",
      accent: "#38bdf8",
      accentSoft: "rgba(56, 189, 248, 0.13)",
      activeBorder: "rgba(56, 189, 248, 0.5)",
    },
    xterm: {
      background: "#09111f",
      foreground: "#e6f2ff",
      cursor: "#38bdf8",
      cursorAccent: "#09111f",
      selectionBackground: "#1e4f73",
      selectionInactiveBackground: "#183248",
    },
  },
  {
    value: "evergreen",
    title: "Evergreen",
    description: "Deep green-black with calm terminal contrast.",
    css: {
      appBg: "#07110d",
      chromeBg: "#08130f",
      terminalBg: "#091510",
      surface: "#0f2119",
      accent: "#34d399",
      accentSoft: "rgba(52, 211, 153, 0.12)",
      activeBorder: "rgba(52, 211, 153, 0.46)",
    },
    xterm: {
      background: "#091510",
      foreground: "#e4f4ed",
      cursor: "#34d399",
      cursorAccent: "#091510",
      selectionBackground: "#1f4d3a",
      selectionInactiveBackground: "#183426",
    },
  },
  {
    value: "rose-noir",
    title: "Rose Noir",
    description: "Soft rose accent on a quiet graphite base.",
    css: {
      appBg: "#12080f",
      chromeBg: "#130911",
      terminalBg: "#160b13",
      surface: "#21101c",
      accent: "#f472b6",
      accentSoft: "rgba(244, 114, 182, 0.13)",
      activeBorder: "rgba(244, 114, 182, 0.48)",
    },
    xterm: {
      background: "#160b13",
      foreground: "#f5e7ef",
      cursor: "#f472b6",
      cursorAccent: "#160b13",
      selectionBackground: "#60324e",
      selectionInactiveBackground: "#3b2232",
    },
  },
  {
    value: "ember",
    title: "Ember",
    description: "Muted red-orange energy for focused build sessions.",
    css: {
      appBg: "#120908",
      chromeBg: "#140a08",
      terminalBg: "#160c0a",
      surface: "#24120d",
      accent: "#fb7185",
      accentSoft: "rgba(251, 113, 133, 0.12)",
      activeBorder: "rgba(251, 113, 133, 0.46)",
    },
    xterm: {
      background: "#160c0a",
      foreground: "#f7e8e4",
      cursor: "#fb7185",
      cursorAccent: "#160c0a",
      selectionBackground: "#5b2527",
      selectionInactiveBackground: "#3c1c1b",
    },
  },
  {
    value: "aurora",
    title: "Aurora",
    description: "Teal-green accent with crisp low-light contrast.",
    css: {
      appBg: "#080d10",
      chromeBg: "#071014",
      terminalBg: "#081419",
      surface: "#0e2026",
      accent: "#2dd4bf",
      accentSoft: "rgba(45, 212, 191, 0.12)",
      activeBorder: "rgba(45, 212, 191, 0.46)",
    },
    xterm: {
      background: "#081419",
      foreground: "#e2f4f1",
      cursor: "#2dd4bf",
      cursorAccent: "#081419",
      selectionBackground: "#1e514d",
      selectionInactiveBackground: "#183735",
    },
  },
  {
    value: "slate-lime",
    title: "Slate Lime",
    description: "Neutral slate with a precise lime command cursor.",
    css: {
      appBg: "#080b09",
      chromeBg: "#090d0a",
      terminalBg: "#0b100c",
      surface: "#111a13",
      accent: "#a3e635",
      accentSoft: "rgba(163, 230, 53, 0.11)",
      activeBorder: "rgba(163, 230, 53, 0.42)",
    },
    xterm: {
      background: "#0b100c",
      foreground: "#eef4e8",
      cursor: "#a3e635",
      cursorAccent: "#0b100c",
      selectionBackground: "#3f5521",
      selectionInactiveBackground: "#2b371d",
    },
  },
];

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
    serverOpenBehavior: "preview",
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

export function themePresetForPreference(theme: ThemePreference): ThemePreset {
  return (
    THEME_PRESETS.find((preset) => preset.value === theme) ?? THEME_PRESETS[0]
  );
}

export function clampTerminalFontSize(fontSize: unknown): number {
  if (typeof fontSize !== "number" || Number.isNaN(fontSize)) {
    return DEFAULT_PREFERENCES.terminal.fontSize;
  }
  return Math.min(18, Math.max(11, Math.round(fontSize)));
}

export function xtermThemeForPreference(theme: ThemePreference) {
  return { ...themePresetForPreference(theme).xterm };
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
  return typeof value === "string" &&
    THEME_PRESET_VALUES.includes(value as ThemePreference)
    ? (value as ThemePreference)
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
  return value === "preview" || value === "external"
    ? value
    : DEFAULT_PREFERENCES.workflow.serverOpenBehavior;
}
