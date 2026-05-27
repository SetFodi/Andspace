import { useEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebglAddon } from "@xterm/addon-webgl";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useStore } from "./terminalStore";
import type { PaneId, TabId } from "./types";

interface Props {
  paneId: PaneId;
  tabId: TabId;
}

interface PtyOutputPayload {
  pane_id: string;
  data: number[];
}

function isAppShortcut(e: KeyboardEvent): boolean {
  if (!e.metaKey || e.ctrlKey || e.altKey) return false;
  const k = e.key;
  return (
    k === "t" ||
    k === "w" ||
    k === "[" ||
    k === "]" ||
    k === "ArrowRight" ||
    k === "ArrowDown" ||
    /^[1-9]$/.test(k)
  );
}

export function TerminalPane({ paneId, tabId }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const setActivePane = useStore((s) => s.setActivePane);
  // A pane is "active" only when its tab is the active tab AND it's the
  // active pane within that tab. This makes focus follow tab switches.
  const isActive = useStore(
    (s) => s.activeTabId === tabId && s.activePaneByTab[tabId] === paneId
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const term = new Terminal({
      fontFamily: '"SF Mono", "JetBrains Mono", Menlo, monospace',
      fontSize: 13,
      lineHeight: 1.2,
      cursorBlink: true,
      cursorStyle: "block",
      allowProposedApi: true,
      scrollback: 10000,
      theme: {
        background: "#0d0e12",
        foreground: "#e6e6ea",
        cursor: "#a78bfa",
        cursorAccent: "#0d0e12",
        selectionBackground: "#3a3550",
      },
    });
    termRef.current = term;

    const fit = new FitAddon();
    term.loadAddon(fit);

    term.attachCustomKeyEventHandler((e) => !isAppShortcut(e));

    term.open(container);

    let webgl: WebglAddon | null = null;
    let initialized = false;
    let cancelled = false;

    // Defer fit + WebGL + PTY resize until the container has its real size.
    // On mount the WKWebView may not have committed layout yet, so xterm's
    // initial cols/rows would be wrong and the WebGL renderer would miss
    // its first paint.
    const initialize = () => {
      if (cancelled || initialized) return;
      const rect = container.getBoundingClientRect();
      if (rect.width < 10 || rect.height < 10) {
        // not laid out yet; the ResizeObserver will retry
        return;
      }
      initialized = true;

      try {
        fit.fit();
      } catch {}

      try {
        webgl = new WebglAddon();
        webgl.onContextLoss(() => webgl?.dispose());
        term.loadAddon(webgl);
      } catch (e) {
        console.warn("WebGL renderer unavailable, using default", e);
      }

      // Diagnostic — write the chosen renderer to /tmp/andspace-diag.log so we
      // can verify which path is active without devtools.
      invoke("report_renderer", { kind: webgl ? "webgl" : "dom" }).catch(() => {});

      invoke("resize_pty", {
        paneId,
        cols: term.cols,
        rows: term.rows,
      }).catch(() => {});

      // Force a paint — WebGL renderer sometimes skips its first frame
      // if the container size changed between open() and load().
      try {
        term.refresh(0, term.rows - 1);
      } catch {}
    };

    const rafId = requestAnimationFrame(initialize);

    const dataDisposable = term.onData((data) => {
      invoke("write_to_pty", { paneId, data }).catch(() => {});
    });

    let unlisten: (() => void) | null = null;
    listen<PtyOutputPayload>("pty-output", (event) => {
      if (event.payload.pane_id !== paneId) return;
      term.write(new Uint8Array(event.payload.data));
    }).then((fn) => {
      unlisten = fn;
    });

    let unlistenExit: (() => void) | null = null;
    listen<string>("pty-exit", (event) => {
      if (event.payload !== paneId) return;
      term.write("\r\n\x1b[2m[process exited]\x1b[0m\r\n");
    }).then((fn) => {
      unlistenExit = fn;
    });

    const syncSize = () => {
      const rect = container.getBoundingClientRect();
      if (rect.width < 10 || rect.height < 10) return;
      if (!initialized) {
        initialize();
        return;
      }
      try {
        fit.fit();
        invoke("resize_pty", {
          paneId,
          cols: term.cols,
          rows: term.rows,
        }).catch(() => {});
      } catch {}
    };

    const ro = new ResizeObserver(syncSize);
    ro.observe(container);

    const onFocus = () => setActivePane(tabId, paneId);
    container.addEventListener("mousedown", onFocus);

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
      dataDisposable.dispose();
      unlisten?.();
      unlistenExit?.();
      ro.disconnect();
      container.removeEventListener("mousedown", onFocus);
      try {
        webgl?.dispose();
      } catch {}
      term.dispose();
      termRef.current = null;
    };
  }, [paneId, tabId, setActivePane]);

  // Focus this pane's xterm when it becomes the active pane in the active tab.
  useEffect(() => {
    if (isActive) {
      // Defer to next frame so layout has settled if we just switched tabs.
      const id = requestAnimationFrame(() => {
        termRef.current?.focus();
      });
      return () => cancelAnimationFrame(id);
    }
  }, [isActive]);

  return (
    <div
      ref={containerRef}
      className={`terminal-pane ${isActive ? "active" : ""}`}
    />
  );
}
