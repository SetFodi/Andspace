// Maps a shell command to the AI CLI it launches (by binary name), or null.
// Used to show agent status on tabs and in the cockpit regardless of whether
// the CLI was launched via ⌘E handoff or typed by hand.
const AI_CLI_BINARIES: Record<string, string> = {
  claude: "Claude",
  codex: "Codex",
  cursor: "Cursor",
  "cursor-agent": "Cursor",
  gemini: "Gemini",
  aider: "Aider",
};

export function aiCliLabelForCommand(
  command: string | undefined
): string | null {
  if (!command) return null;
  const first = command.trim().split(/\s+/)[0];
  if (!first) return null;
  const binary = first.split("/").pop()?.toLowerCase() ?? "";
  return AI_CLI_BINARIES[binary] ?? null;
}
