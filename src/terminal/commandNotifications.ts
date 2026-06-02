// Native "your command finished" notifications.
//
// The whole point is to catch you when you've tabbed away: when a command (or a
// handed-off AI CLI, which runs as a command in a split pane) finishes while
// AndSpace is in the background and it ran longer than the threshold, fire a
// macOS notification. When the window is focused you can already see it, so we
// stay quiet.

import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";

// AI CLIs we hand off to — used purely to give the notification nicer copy
// ("Claude finished" instead of the raw command line).
const AI_CLI_LABELS: { re: RegExp; label: string }[] = [
  { re: /(^|\/|\s)claude(\s|$)/, label: "Claude" },
  { re: /(^|\/|\s)codex(\s|$)/, label: "Codex" },
  { re: /(^|\/|\s)cursor-agent(\s|$)|(^|\/|\s)cursor(\s|$)/, label: "Cursor" },
  { re: /(^|\/|\s)gemini(\s|$)/, label: "Gemini" },
  { re: /(^|\/|\s)aider(\s|$)/, label: "Aider" },
];

let permissionState: "unknown" | "granted" | "denied" = "unknown";

async function ensurePermission(): Promise<boolean> {
  if (permissionState === "granted") return true;
  if (permissionState === "denied") return false;
  try {
    let granted = await isPermissionGranted();
    if (!granted) {
      granted = (await requestPermission()) === "granted";
    }
    permissionState = granted ? "granted" : "denied";
    return granted;
  } catch {
    permissionState = "denied";
    return false;
  }
}

/**
 * Ask for notification permission ahead of time (if the feature is enabled) so
 * the first real notification isn't lost to the permission prompt. No-op once
 * permission has been resolved.
 */
export async function primeNotificationPermission(
  enabled: boolean
): Promise<void> {
  if (!enabled) return;
  await ensurePermission();
}

/**
 * Fire a one-off notification so the user can confirm notifications work (and
 * trigger the macOS permission prompt) on demand. Does a fresh permission
 * check rather than using the cached state.
 */
export async function sendTestNotification(): Promise<"sent" | "denied" | "error"> {
  try {
    let granted = await isPermissionGranted();
    if (!granted) {
      granted = (await requestPermission()) === "granted";
    }
    permissionState = granted ? "granted" : "denied";
    if (!granted) return "denied";
    sendNotification({
      title: "AndSpace notifications are on",
      body: "You'll get a ping when a long command finishes while you're away.",
    });
    return "sent";
  } catch {
    return "error";
  }
}

function formatDuration(ms: number): string {
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return remainder ? `${minutes}m ${remainder}s` : `${minutes}m`;
}

function truncate(value: string, max: number): string {
  const trimmed = value.trim();
  return trimmed.length > max ? `${trimmed.slice(0, max - 1)}…` : trimmed;
}

function aiCliLabel(command: string): string | null {
  const head = command.trim().slice(0, 80).toLowerCase();
  for (const { re, label } of AI_CLI_LABELS) {
    if (re.test(head)) return label;
  }
  return null;
}

export interface CommandFinishNotice {
  command: string;
  exitCode: number;
  durationMs: number;
  enabled: boolean;
  minDurationSeconds: number;
}

export async function maybeNotifyCommandFinish(
  notice: CommandFinishNotice
): Promise<void> {
  if (!notice.enabled) return;
  if (!notice.command.trim()) return;
  // Only when AndSpace is in the background — if it's focused you can see it.
  if (document.hasFocus()) return;
  if (notice.durationMs < notice.minDurationSeconds * 1000) return;

  const granted = await ensurePermission();
  if (!granted) return;

  const ok = notice.exitCode === 0;
  const agent = aiCliLabel(notice.command);
  const duration = formatDuration(notice.durationMs);

  let title: string;
  let body: string;
  if (agent) {
    title = ok ? `${agent} finished` : `${agent} exited (${notice.exitCode})`;
    body = `${duration} · ${truncate(notice.command, 80)}`;
  } else if (ok) {
    title = "Command finished";
    body = `${truncate(notice.command, 80)} · ${duration}`;
  } else {
    title = `Command failed · exit ${notice.exitCode}`;
    body = `${truncate(notice.command, 80)} · ${duration}`;
  }

  try {
    sendNotification({ title, body });
  } catch {
    /* notification channel unavailable */
  }
}
