import type { DetectedServer } from "./serverStore";

export interface LocalPreviewTarget {
  url: string;
  displayUrl: string;
  label: string;
  port: number;
}

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0"]);

export function buildLocalPreviewTarget(
  server: DetectedServer
): LocalPreviewTarget | null {
  return buildLocalPreviewTargetFromUrl(server.url, server.label, server.port);
}

export function buildLocalPreviewTargetFromUrl(
  raw: string,
  label = "Local",
  explicitPort?: number
): LocalPreviewTarget | null {
  const url = normalizeLocalPreviewUrl(raw);
  if (!url) return null;
  const parsed = new URL(url);
  return {
    url,
    displayUrl: url.replace(/^https?:\/\//, ""),
    label,
    port:
      explicitPort ??
      Number(parsed.port || (parsed.protocol === "https:" ? 443 : 80)),
  };
}

export function normalizeLocalPreviewUrl(raw: string): string | null {
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (!isAllowedLocalHost(url.hostname)) return null;
    if (url.hostname === "0.0.0.0") url.hostname = "localhost";
    const path = url.pathname === "/" ? "" : url.pathname;
    return `${url.protocol}//${url.host}${path}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

export function isAllowedLocalHost(host: string): boolean {
  const normalized = host.toLowerCase();
  if (LOCAL_HOSTS.has(normalized)) return true;
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(normalized)) return true;
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(normalized)) return true;
  return /^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(
    normalized
  );
}
