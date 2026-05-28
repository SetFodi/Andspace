#!/usr/bin/env node --experimental-strip-types --no-warnings
// Tiny standalone test for src/terminal/serverDetection.ts.
//
// The repo has no JS test runner. Node 22.6+ ships a built-in TypeScript
// stripper that handles import-time .ts modules, so we lean on that
// instead of pulling vitest or jest in just for one module of helpers.
//
// Run from the repo root:
//   node --experimental-strip-types --no-warnings scripts/test-server-detection.mjs
// or just:
//   ./scripts/test-server-detection.mjs

import assert from "node:assert/strict";
import {
  inferServerLabel,
  ingestChunk,
  createServerDetectionContext,
  parseLocalhostUrls,
  shortServerUrl,
} from "../src/terminal/serverDetection.ts";

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

console.log("serverDetection");

test("parses simple localhost URL", () => {
  const out = parseLocalhostUrls("Local: http://localhost:3000");
  assert.equal(out.length, 1);
  assert.equal(out[0].url, "http://localhost:3000");
  assert.equal(out[0].host, "localhost");
  assert.equal(out[0].port, 3000);
});

test("parses 127.0.0.1 and 0.0.0.0", () => {
  const out = parseLocalhostUrls(
    "Listening on http://127.0.0.1:5173 and http://0.0.0.0:3000"
  );
  assert.equal(out.length, 2);
  assert.equal(out[0].port, 5173);
  assert.equal(out[1].port, 3000);
});

test("parses LAN address with valid range", () => {
  const out = parseLocalhostUrls("Network: http://192.168.1.42:5173/");
  assert.equal(out.length, 1);
  assert.equal(out[0].host, "192.168.1.42");
});

test("parses https URL", () => {
  const out = parseLocalhostUrls("https://localhost:3000/api");
  assert.equal(out.length, 1);
  assert.equal(out[0].url, "https://localhost:3000/api");
});

test("strips trailing slash for dedup", () => {
  const out = parseLocalhostUrls(
    "http://localhost:3000/ http://localhost:3000"
  );
  assert.equal(out.length, 1);
  assert.equal(out[0].url, "http://localhost:3000");
});

test("strips ANSI escape sequences", () => {
  const ctx = createServerDetectionContext();
  const ansi = "  \x1b[32mLocal:\x1b[0m   \x1b[36mhttp://localhost:5173/\x1b[0m";
  const out = ingestChunk(ctx, ansi);
  assert.equal(out.length, 1);
  assert.equal(out[0].url, "http://localhost:5173");
});

test("does not match public/global IPs", () => {
  const out = parseLocalhostUrls("Production: https://example.com:3000");
  assert.equal(out.length, 0);
});

test("infers Next.js label from banner", () => {
  const label = inferServerLabel("▲ Next.js 14.0.0 - Local:", {
    url: "http://localhost:3000",
    host: "localhost",
    port: 3000,
  });
  assert.equal(label, "Next.js");
});

test("infers Vite label", () => {
  const label = inferServerLabel("VITE v5 ready", {
    url: "http://localhost:5173",
    host: "localhost",
    port: 5173,
  });
  assert.equal(label, "Vite");
});

test("infers API label from path", () => {
  const label = inferServerLabel("", {
    url: "http://localhost:3001/api",
    host: "localhost",
    port: 3001,
  });
  assert.equal(label, "API");
});

test("falls back to 'Local' when nothing matches", () => {
  const label = inferServerLabel("", {
    url: "http://localhost:9999",
    host: "localhost",
    port: 9999,
  });
  assert.equal(label, "Local");
});

test("shortServerUrl drops scheme", () => {
  assert.equal(shortServerUrl("http://localhost:3000"), "localhost:3000");
  assert.equal(
    shortServerUrl("https://127.0.0.1:5173/api"),
    "127.0.0.1:5173/api"
  );
});

test("ingestChunk dedups within rolling buffer", () => {
  const ctx = createServerDetectionContext();
  ingestChunk(ctx, "Listening on http://localhost:3000\n");
  const second = ingestChunk(ctx, "ready in 230ms\n");
  // Second call returns the same URL because the buffer still holds it.
  // Dedup is the store's job; parser just exposes what's in the buffer.
  assert.equal(second.length, 1);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
