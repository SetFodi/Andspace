#!/usr/bin/env node --experimental-strip-types --no-warnings
// Standalone tests for the pure preferences model.

import assert from "node:assert/strict";
import {
  DEFAULT_PREFERENCES,
  THEME_PRESETS,
  clampTerminalFontSize,
  normalizePreferences,
  scrollbackRowsForProfile,
} from "../src/terminal/preferencesModel.ts";
import { defaultActionFor } from "../src/terminal/fileActions.ts";

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ok ${name}`);
    passed++;
  } catch (e) {
    console.error(`  FAIL ${name}`);
    console.error(`    ${e.message}`);
    failed++;
  }
}

console.log("preferences");

test("defaults are local-first and safe", () => {
  const preferences = normalizePreferences(null);

  assert.equal(preferences.version, 1);
  assert.equal(preferences.onboardingCompleted, false);
  assert.equal(preferences.theme, "graphite-violet");
  assert.equal(preferences.workflow.defaultAiCli, "ask");
  assert.equal(preferences.workflow.defaultFileAction, "auto");
  assert.equal(preferences.workflow.serverOpenBehavior, "preview");
  assert.equal(preferences.safety.workspaceRestoreEnabled, true);
  assert.equal(preferences.safety.commandGuardEnabled, true);
});

test("normalizes partial preference JSON", () => {
  const preferences = normalizePreferences({
    onboardingCompleted: true,
    theme: "evergreen",
    terminal: { fontSize: 16 },
    workflow: { defaultAiCli: "claude" },
  });

  assert.equal(preferences.onboardingCompleted, true);
  assert.equal(preferences.theme, "evergreen");
  assert.equal(preferences.terminal.fontSize, 16);
  assert.equal(preferences.terminal.scrollbackProfile, "balanced");
  assert.equal(preferences.workflow.defaultAiCli, "claude");
  assert.equal(preferences.workflow.defaultFileAction, "auto");
});

test("exposes ten local color schemes", () => {
  assert.equal(THEME_PRESETS.length, 10);
  assert.deepEqual(
    THEME_PRESETS.map((theme) => theme.value),
    [
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
    ]
  );
});

test("tolerates newer version numbers", () => {
  const preferences = normalizePreferences({
    version: 99,
    theme: "pure-dark",
  });

  assert.equal(preferences.version, 99);
  assert.equal(preferences.theme, "pure-dark");
});

test("rejects unknown enum values", () => {
  const preferences = normalizePreferences({
    theme: "solarized",
    terminal: { scrollbackProfile: "forever" },
    workflow: { defaultFileAction: "delete", defaultAiCli: "remote" },
  });

  assert.equal(preferences.theme, DEFAULT_PREFERENCES.theme);
  assert.equal(
    preferences.terminal.scrollbackProfile,
    DEFAULT_PREFERENCES.terminal.scrollbackProfile
  );
  assert.equal(
    preferences.workflow.defaultFileAction,
    DEFAULT_PREFERENCES.workflow.defaultFileAction
  );
  assert.equal(
    preferences.workflow.defaultAiCli,
    DEFAULT_PREFERENCES.workflow.defaultAiCli
  );
});

test("clamps terminal font size", () => {
  assert.equal(clampTerminalFontSize(8), 11);
  assert.equal(clampTerminalFontSize(99), 18);
  assert.equal(clampTerminalFontSize(14.4), 14);
});

test("maps scrollback profiles to bounded rows", () => {
  assert.equal(scrollbackRowsForProfile("memory-saver"), 1000);
  assert.equal(scrollbackRowsForProfile("balanced"), 5000);
  assert.equal(scrollbackRowsForProfile("long-history"), 15000);
});

test("default file action honors available preferred tools", () => {
  assert.deepEqual(
    defaultActionFor({ cursor: true, code: true, nvim: true, vim: false }, "code"),
    { type: "open", tool: "code", label: "Open in VS Code" }
  );
  assert.deepEqual(
    defaultActionFor(
      { cursor: false, code: false, nvim: true, vim: false },
      "nvim-split"
    ),
    { type: "nvim-split", label: "Open in Neovim split" }
  );
});

test("default file action falls back safely when preferred CLI is missing", () => {
  assert.deepEqual(
    defaultActionFor(
      { cursor: false, code: false, nvim: false, vim: false },
      "cursor"
    ),
    { type: "copy", label: "Copy path" }
  );
});

console.log(`preferences: ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
