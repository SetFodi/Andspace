// Lightweight local-server detection.
//
// Parses dev-server URLs from raw PTY chunks as they stream in. No port
// scanning, no fetches — detection only happens on text that has already
// flowed through the terminal. Each pane keeps a small rolling context
// buffer so framework names that print *before* the URL (e.g. Next.js'
// banner) can still be matched.

const LOCALHOST_HOST = /(?:localhost|127\.0\.0\.1|0\.0\.0\.0)/;
const LAN_HOST = /(?:10|192\.168|172\.(?:1[6-9]|2\d|3[01]))\.\d{1,3}\.\d{1,3}/;
const URL_REGEX = new RegExp(
  `https?://(?:${LOCALHOST_HOST.source}|${LAN_HOST.source})(?::\\d{1,5})?(?:/[^\\s\\u001b"'<>)\\]]*)?`,
  "gi"
);

// xterm-style ANSI escape sequences. We strip these before regex matching
// so colored "Local:" prefixes don't break URL extraction.
const ANSI_REGEX = /\x1B\[[0-9;?]*[A-Za-z]/g;

export interface ParsedServer {
  url: string;
  host: string;
  port: number;
}

export interface ServerDetectionContext {
  /// Rolling text buffer for this pane (most recent ~4 KB of output).
  buffer: string;
}

export function createServerDetectionContext(): ServerDetectionContext {
  return { buffer: "" };
}

const CONTEXT_WINDOW_BYTES = 4096;

/// Append a chunk to the per-pane context buffer and return any new
/// localhost URLs that appeared in it. The caller (the store) is
/// responsible for deduplicating against already-known servers.
export function ingestChunk(
  ctx: ServerDetectionContext,
  chunk: string
): ParsedServer[] {
  if (!chunk) return [];
  const clean = stripAnsi(chunk);
  ctx.buffer = (ctx.buffer + clean).slice(-CONTEXT_WINDOW_BYTES);
  return parseLocalhostUrls(ctx.buffer);
}

export function stripAnsi(text: string): string {
  return text.replace(ANSI_REGEX, "");
}

/// Pure URL extraction. Exported for tests. Returns unique parsed servers
/// in first-seen order with normalized URLs (no trailing slash).
export function parseLocalhostUrls(text: string): ParsedServer[] {
  const seen = new Set<string>();
  const out: ParsedServer[] = [];
  const matches = text.match(URL_REGEX) ?? [];
  for (const raw of matches) {
    const parsed = parseOne(raw);
    if (!parsed) continue;
    if (seen.has(parsed.url)) continue;
    seen.add(parsed.url);
    out.push(parsed);
  }
  return out;
}

function parseOne(raw: string): ParsedServer | null {
  try {
    const trimmed = raw.replace(/[).,;]+$/, "");
    const url = new URL(trimmed);
    const host = url.hostname;
    const port = url.port ? Number(url.port) : url.protocol === "https:" ? 443 : 80;
    if (!Number.isFinite(port) || port < 1 || port > 65535) return null;
    // Drop trailing slash from the path so http://localhost:3000 and
    // http://localhost:3000/ are treated as the same server.
    const path = url.pathname === "/" ? "" : url.pathname;
    return {
      url: `${url.protocol}//${host}${url.port ? `:${url.port}` : ""}${path}`,
      host,
      port,
    };
  } catch {
    return null;
  }
}

/// Best-effort framework label from the context buffer + URL. Looks for
/// framework keywords in the surrounding text first, then falls back to
/// well-known port defaults, then to the path or a generic "Local".
export function inferServerLabel(
  context: string,
  server: ParsedServer
): string {
  const ctx = context.toLowerCase();
  if (/next\.?js|▲ next/.test(ctx)) return "Next.js";
  if (/\bvite\b/.test(ctx)) return "Vite";
  if (/\bastro\b/.test(ctx)) return "Astro";
  if (/\bnestjs|nest application/.test(ctx)) return "NestJS";
  if (/\bremix\b/.test(ctx)) return "Remix";
  if (/\bsvelte(?:kit)?\b/.test(ctx)) return "SvelteKit";
  if (/\bstorybook\b/.test(ctx)) return "Storybook";

  // Path-based hints when framework banner isn't present.
  if (server.url.includes("/api") || server.url.includes("/graphql")) {
    return "API";
  }

  // Port defaults. Only used when the framework banner didn't print, e.g.
  // the user re-attached to a running process via a different command.
  switch (server.port) {
    case 3000:
      return "Local"; // 3000 is shared by Next.js, Express, and lots of others — no confident label.
    case 5173:
      return "Vite";
    case 4321:
      return "Astro";
    case 6006:
      return "Storybook";
    case 8080:
      return "Local";
    case 8000:
      return "Local";
    default:
      return "Local";
  }
}

export function shortServerUrl(url: string): string {
  // Drop scheme for compact sidebar rows: localhost:3000 instead of
  // http://localhost:3000.
  return url.replace(/^https?:\/\//, "");
}
