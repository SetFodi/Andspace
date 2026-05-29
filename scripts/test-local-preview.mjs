#!/usr/bin/env node --experimental-strip-types --no-warnings
// Standalone tests for local preview URL safety.

import assert from "node:assert/strict";
import {
  buildLocalPreviewTarget,
  isAllowedLocalHost,
  normalizeLocalPreviewUrl,
} from "../src/terminal/localPreview.ts";

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

console.log("local preview");

test("allows localhost and private LAN hosts", () => {
  assert.equal(isAllowedLocalHost("localhost"), true);
  assert.equal(isAllowedLocalHost("127.0.0.1"), true);
  assert.equal(isAllowedLocalHost("0.0.0.0"), true);
  assert.equal(isAllowedLocalHost("192.168.1.10"), true);
  assert.equal(isAllowedLocalHost("10.0.0.2"), true);
  assert.equal(isAllowedLocalHost("172.16.0.3"), true);
  assert.equal(isAllowedLocalHost("172.31.0.3"), true);
});

test("rejects public hosts", () => {
  assert.equal(isAllowedLocalHost("example.com"), false);
  assert.equal(isAllowedLocalHost("8.8.8.8"), false);
  assert.equal(isAllowedLocalHost("172.32.0.3"), false);
});

test("normalizes 0.0.0.0 to localhost", () => {
  assert.equal(
    normalizeLocalPreviewUrl("http://0.0.0.0:5173/dashboard"),
    "http://localhost:5173/dashboard"
  );
});

test("rejects non-http protocols", () => {
  assert.equal(normalizeLocalPreviewUrl("file:///tmp/index.html"), null);
  assert.equal(normalizeLocalPreviewUrl("javascript:alert(1)"), null);
});

test("builds preview target from detected server", () => {
  assert.deepEqual(
    buildLocalPreviewTarget({
      url: "http://localhost:3000",
      host: "localhost",
      port: 3000,
      label: "Next.js",
      paneId: "pane-1",
      firstSeenAt: 1,
      lastSeenAt: 2,
    }),
    {
      url: "http://localhost:3000",
      displayUrl: "localhost:3000",
      label: "Next.js",
      port: 3000,
    }
  );
});

console.log(`local preview: ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
