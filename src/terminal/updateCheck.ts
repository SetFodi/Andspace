export const GITHUB_RELEASES_PAGE =
  "https://github.com/SetFodi/Andspace/releases";
export const GITHUB_LATEST_RELEASE_API =
  "https://api.github.com/repos/SetFodi/Andspace/releases/latest";
export const GITHUB_RELEASES_API =
  "https://api.github.com/repos/SetFodi/Andspace/releases?per_page=10";

export interface LatestRelease {
  tagName: string;
  name: string;
  htmlUrl: string;
  prerelease: boolean;
}

export interface UpdateCheckResult {
  currentTag: string;
  latest: LatestRelease;
  status: "newer" | "current";
}

type FetchLike = (
  input: string,
  init?: { headers?: Record<string, string> }
) => Promise<{
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}>;

interface ParsedVersion {
  major: number;
  minor: number;
  patch: number;
  prerelease: string[];
}

export async function checkForUpdates(
  currentVersion: string,
  fetchImpl: FetchLike = fetch
): Promise<UpdateCheckResult> {
  const latest = await fetchLatestGitHubRelease(fetchImpl);
  const comparison = compareVersionTags(currentVersion, latest.tagName);
  return {
    currentTag: formatVersionTag(currentVersion),
    latest,
    status: comparison < 0 ? "newer" : "current",
  };
}

export async function fetchLatestGitHubRelease(
  fetchImpl: FetchLike = fetch
): Promise<LatestRelease> {
  try {
    const json = await fetchJson(GITHUB_LATEST_RELEASE_API, fetchImpl);
    const latest = parseGitHubRelease(json);
    if (latest) return latest;
  } catch {
    // Prerelease-only repos can make /latest return 404. Fall through to the
    // releases list, which includes prereleases and still excludes drafts.
  }

  const listJson = await fetchJson(GITHUB_RELEASES_API, fetchImpl);
  const fromList = parseGitHubReleaseList(listJson);
  if (!fromList) throw new Error("No public release found");
  return fromList;
}

export function parseGitHubRelease(input: unknown): LatestRelease | null {
  if (!input || typeof input !== "object") return null;
  const record = input as Record<string, unknown>;
  if (record.draft === true) return null;
  if (typeof record.tag_name !== "string") return null;
  if (typeof record.html_url !== "string") return null;
  return {
    tagName: record.tag_name,
    name: typeof record.name === "string" && record.name ? record.name : record.tag_name,
    htmlUrl: record.html_url,
    prerelease: record.prerelease === true,
  };
}

export function parseGitHubReleaseList(input: unknown): LatestRelease | null {
  if (!Array.isArray(input)) return null;
  for (const item of input) {
    const parsed = parseGitHubRelease(item);
    if (parsed) return parsed;
  }
  return null;
}

export function compareVersionTags(left: string, right: string): number {
  const a = parseVersionTag(left);
  const b = parseVersionTag(right);
  if (!a || !b) throw new Error("Invalid version tag");

  for (const key of ["major", "minor", "patch"] as const) {
    if (a[key] !== b[key]) return a[key] > b[key] ? 1 : -1;
  }

  if (a.prerelease.length === 0 && b.prerelease.length === 0) return 0;
  if (a.prerelease.length === 0) return 1;
  if (b.prerelease.length === 0) return -1;

  const length = Math.max(a.prerelease.length, b.prerelease.length);
  for (let i = 0; i < length; i++) {
    const partA = a.prerelease[i];
    const partB = b.prerelease[i];
    if (partA === undefined) return -1;
    if (partB === undefined) return 1;
    const compared = comparePrereleasePart(partA, partB);
    if (compared !== 0) return compared;
  }
  return 0;
}

export function formatVersionTag(version: string): string {
  const trimmed = version.trim();
  return trimmed.startsWith("v") ? trimmed : `v${trimmed}`;
}

function parseVersionTag(input: string): ParsedVersion | null {
  const trimmed = input.trim().replace(/^v/, "");
  const match = trimmed.match(/^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/);
  if (!match) return null;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease: match[4] ? match[4].split(".") : [],
  };
}

function comparePrereleasePart(left: string, right: string): number {
  const leftNumber = numericIdentifier(left);
  const rightNumber = numericIdentifier(right);
  if (leftNumber !== null && rightNumber !== null) {
    if (leftNumber === rightNumber) return 0;
    return leftNumber > rightNumber ? 1 : -1;
  }
  if (leftNumber !== null) return -1;
  if (rightNumber !== null) return 1;
  if (left === right) return 0;
  return left > right ? 1 : -1;
}

function numericIdentifier(input: string): number | null {
  if (!/^(0|[1-9]\d*)$/.test(input)) return null;
  return Number(input);
}

async function fetchJson(url: string, fetchImpl: FetchLike): Promise<unknown> {
  const response = await fetchImpl(url, {
    headers: { Accept: "application/vnd.github+json" },
  });
  if (!response.ok) throw new Error(`GitHub responded with ${response.status}`);
  return response.json();
}
