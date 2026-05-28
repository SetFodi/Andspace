#!/usr/bin/env node --experimental-strip-types --no-warnings
// Standalone tests for split-tree pane focus navigation.
//
// Run from the repo root:
//   node --experimental-strip-types --no-warnings scripts/test-pane-navigation.mjs

import assert from "node:assert/strict";
import { findNearestPaneInDirection } from "../src/terminal/paneNavigation.ts";

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

function column(a, b) {
  return { kind: "split", direction: "column", a, b };
}

console.log("paneNavigation");

test("moves horizontally across a simple row split", () => {
  const root = row(pane("left"), pane("right"));
  assert.equal(findNearestPaneInDirection(root, "left", "right"), "right");
  assert.equal(findNearestPaneInDirection(root, "right", "left"), "left");
});

test("moves vertically across a simple column split", () => {
  const root = column(pane("top"), pane("bottom"));
  assert.equal(findNearestPaneInDirection(root, "top", "down"), "bottom");
  assert.equal(findNearestPaneInDirection(root, "bottom", "up"), "top");
});

test("chooses the pane sharing the active edge", () => {
  const root = column(
    row(pane("top-left"), pane("top-right")),
    row(pane("bottom-left"), pane("bottom-right"))
  );
  assert.equal(
    findNearestPaneInDirection(root, "top-left", "right"),
    "top-right"
  );
  assert.equal(
    findNearestPaneInDirection(root, "top-left", "down"),
    "bottom-left"
  );
  assert.equal(
    findNearestPaneInDirection(root, "bottom-right", "left"),
    "bottom-left"
  );
  assert.equal(
    findNearestPaneInDirection(root, "bottom-right", "up"),
    "top-right"
  );
});

test("moves from stacked panes to a full-height neighbor", () => {
  const root = row(column(pane("top-left"), pane("bottom-left")), pane("right"));
  assert.equal(findNearestPaneInDirection(root, "top-left", "right"), "right");
  assert.equal(
    findNearestPaneInDirection(root, "bottom-left", "right"),
    "right"
  );
});

test("does nothing when no pane exists in the requested direction", () => {
  const root = row(column(pane("top-left"), pane("bottom-left")), pane("right"));
  assert.equal(findNearestPaneInDirection(root, "right", "right"), null);
  assert.equal(findNearestPaneInDirection(root, "right", "up"), null);
  assert.equal(findNearestPaneInDirection(root, "right", "down"), null);
});

if (failed > 0) {
  console.error(`paneNavigation: ${failed} failed, ${passed} passed`);
  process.exit(1);
}

console.log(`paneNavigation: ${passed} passed, 0 failed`);
