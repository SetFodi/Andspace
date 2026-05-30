#!/usr/bin/env node --experimental-strip-types --no-warnings
// Standalone tests for the manual update-check helpers.

import assert from "node:assert/strict";
import {
  checkForUpdates,
  compareVersionTags,
  formatVersionTag,
  GITHUB_LATEST_RELEASE_API,
  GITHUB_RELEASES_API,
  parseGitHubRelease,
  parseGitHubReleaseList,
} from "../src/terminal/updateCheck.ts";

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

function asyncTest(name, fn) {
  return fn()
    .then(() => {
      console.log(`  ok ${name}`);
      passed++;
    })
    .catch((e) => {
      console.error(`  FAIL ${name}`);
      console.error(`    ${e.message}`);
      failed++;
    });
}

function response(ok, status, json) {
  return {
    ok,
    status,
    json: async () => json,
  };
}

console.log("updateCheck");

test("formats bare versions as tags", () => {
  assert.equal(formatVersionTag("0.1.0-alpha.7"), "v0.1.0-alpha.7");
  assert.equal(formatVersionTag("v0.1.0-alpha.7"), "v0.1.0-alpha.7");
});

test("compares alpha prerelease numbers numerically", () => {
  assert.equal(compareVersionTags("v0.1.0-alpha.7", "v0.1.0-alpha.8"), -1);
  assert.equal(compareVersionTags("v0.1.0-alpha.10", "v0.1.0-alpha.8"), 1);
  assert.equal(compareVersionTags("0.1.0-alpha.7", "v0.1.0-alpha.7"), 0);
});

test("compares stable versions above prereleases", () => {
  assert.equal(compareVersionTags("v0.1.0-alpha.9", "v0.1.0"), -1);
  assert.equal(compareVersionTags("v0.1.1", "v0.1.0-alpha.99"), 1);
});

test("parses a GitHub release response", () => {
  const parsed = parseGitHubRelease({
    tag_name: "v0.1.0-alpha.8",
    name: "AndSpace v0.1.0-alpha.8",
    html_url: "https://github.com/SetFodi/Andspace/releases/tag/v0.1.0-alpha.8",
    prerelease: true,
  });
  assert(parsed);
  assert.equal(parsed.tagName, "v0.1.0-alpha.8");
  assert.equal(parsed.prerelease, true);
});

test("ignores draft or invalid GitHub responses", () => {
  assert.equal(
    parseGitHubRelease({
      draft: true,
      tag_name: "v0.1.0-alpha.8",
      html_url: "https://example.com",
    }),
    null
  );
  assert.equal(parseGitHubRelease({ tag_name: "v0.1.0-alpha.8" }), null);
});

test("parses the first non-draft release from a list", () => {
  const parsed = parseGitHubReleaseList([
    { draft: true, tag_name: "v0.1.0-alpha.9", html_url: "https://example.com" },
    {
      tag_name: "v0.1.0-alpha.8",
      html_url: "https://github.com/SetFodi/Andspace/releases/tag/v0.1.0-alpha.8",
    },
  ]);
  assert(parsed);
  assert.equal(parsed.tagName, "v0.1.0-alpha.8");
});

await asyncTest("returns newer when GitHub has a higher alpha", async () => {
  const result = await checkForUpdates("0.1.0-alpha.7", async () =>
    response(true, 200, {
      tag_name: "v0.1.0-alpha.8",
      html_url: "https://github.com/SetFodi/Andspace/releases/tag/v0.1.0-alpha.8",
    })
  );
  assert.equal(result.status, "newer");
  assert.equal(result.currentTag, "v0.1.0-alpha.7");
});

await asyncTest("returns current for same or older latest releases", async () => {
  const same = await checkForUpdates("0.1.0-alpha.7", async () =>
    response(true, 200, {
      tag_name: "v0.1.0-alpha.7",
      html_url: "https://github.com/SetFodi/Andspace/releases/tag/v0.1.0-alpha.7",
    })
  );
  assert.equal(same.status, "current");

  const older = await checkForUpdates("0.1.0-alpha.8", async () =>
    response(true, 200, {
      tag_name: "v0.1.0-alpha.7",
      html_url: "https://github.com/SetFodi/Andspace/releases/tag/v0.1.0-alpha.7",
    })
  );
  assert.equal(older.status, "current");
});

await asyncTest("falls back to release list when latest endpoint fails", async () => {
  const calls = [];
  const result = await checkForUpdates("0.1.0-alpha.7", async (url) => {
    calls.push(url);
    if (url === GITHUB_LATEST_RELEASE_API) {
      return response(false, 404, {});
    }
    assert.equal(url, GITHUB_RELEASES_API);
    return response(true, 200, [
      {
        tag_name: "v0.1.0-alpha.8",
        html_url: "https://github.com/SetFodi/Andspace/releases/tag/v0.1.0-alpha.8",
        prerelease: true,
      },
    ]);
  });

  assert.equal(result.status, "newer");
  assert.deepEqual(calls, [GITHUB_LATEST_RELEASE_API, GITHUB_RELEASES_API]);
});

console.log(`updateCheck: ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
