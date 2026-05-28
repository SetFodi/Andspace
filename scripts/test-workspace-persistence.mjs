#!/usr/bin/env node --experimental-strip-types --no-warnings
// Standalone tests for the pure workspace persistence model.

import assert from "node:assert/strict";
import {
  buildWorkspaceSnapshot,
  chooseWindowPlacement,
  collectPersistedPaneIds,
  normalizeWorkspaceSnapshot,
  remapPersistedSplitNode,
  restoreCwdForPane,
} from "../src/terminal/workspaceModel.ts";

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

function pane(paneId) {
  return { kind: "pane", paneId };
}

function row(a, b) {
  return { kind: "split", direction: "row", a, b };
}

console.log("workspacePersistence");

test("serializes only lightweight workspace state", () => {
  const snapshot = buildWorkspaceSnapshot({
    tabs: [{ id: "tab-1", title: "shell", root: row(pane("p1"), pane("p2")) }],
    activeTabId: "tab-1",
    activePaneByTab: { "tab-1": "p2" },
    paneMeta: {
      p1: { cwd: "/repo", lastCommand: "SECRET=abc", commandRunning: true },
      p2: { cwd: "/repo/src", lastCommand: "pnpm dev", lastExitCode: 0 },
    },
    sidebarOpen: true,
    sidebarSection: "servers",
    projectRoot: "/repo",
    window: { x: 10, y: 20, width: 1200, height: 800 },
  });
  const raw = JSON.stringify(snapshot);

  assert.equal(snapshot.version, 1);
  assert.equal(snapshot.activePaneId, "p2");
  assert.equal(snapshot.panes.p1.cwd, "/repo");
  assert.equal(snapshot.sidebar.open, true);
  assert.equal(snapshot.sidebar.focusedSection, "servers");
  assert(!raw.includes("SECRET=abc"));
  assert(!raw.includes("pnpm dev"));
  assert(!raw.includes("lastCommand"));
});

test("normalizes old or partial workspace JSON", () => {
  const snapshot = normalizeWorkspaceSnapshot({
    tabs: [{ id: "tab-1", title: "shell", root: pane("p1") }],
  });

  assert(snapshot);
  assert.equal(snapshot.version, 1);
  assert.equal(snapshot.activeTabId, "tab-1");
  assert.equal(snapshot.sidebar.open, false);
  assert.equal(snapshot.sidebar.focusedSection, "files");
});

test("tolerates newer version numbers", () => {
  const snapshot = normalizeWorkspaceSnapshot({
    version: 99,
    activeTabId: "tab-1",
    tabs: [{ id: "tab-1", title: "shell", root: pane("p1") }],
  });

  assert(snapshot);
  assert.equal(snapshot.version, 99);
  assert.equal(snapshot.activeTabId, "tab-1");
});

test("remaps restored split layout to new pane ids", () => {
  const snapshot = normalizeWorkspaceSnapshot({
    tabs: [
      {
        id: "tab-1",
        title: "shell",
        root: row(pane("old-left"), pane("old-right")),
      },
    ],
  });
  assert(snapshot);
  assert.deepEqual(collectPersistedPaneIds(snapshot), ["old-left", "old-right"]);
  const root = remapPersistedSplitNode(snapshot.tabs[0].root, {
    "old-left": "new-left",
    "old-right": "new-right",
  });

  assert.deepEqual(root, row(pane("new-left"), pane("new-right")));
});

test("cwd fallback model uses home when saved cwd is gone", () => {
  const exists = (path) => path === "/repo";

  assert.equal(restoreCwdForPane("/repo", "/home/me", exists), "/repo");
  assert.equal(restoreCwdForPane("/missing", "/home/me", exists), "/home/me");
  assert.equal(restoreCwdForPane(undefined, "/home/me", exists), "/home/me");
});

test("window placement is clamped onto an available monitor", () => {
  const placement = chooseWindowPlacement(
    { x: 9000, y: 9000, width: 1400, height: 900 },
    [{ x: 0, y: 0, width: 1920, height: 1080 }]
  );

  assert.equal(placement.width, 1400);
  assert.equal(placement.height, 900);
  assert.equal(placement.x, 520);
  assert.equal(placement.y, 180);
});

test("window placement keeps visible saved positions", () => {
  const saved = { x: 100, y: 120, width: 1400, height: 900 };

  assert.deepEqual(
    chooseWindowPlacement(saved, [{ x: 0, y: 0, width: 1920, height: 1080 }]),
    saved
  );
});

console.log(`workspacePersistence: ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
