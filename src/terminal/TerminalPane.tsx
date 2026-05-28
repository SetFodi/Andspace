import { useEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebglAddon } from "@xterm/addon-webgl";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { installShellIntegration } from "./shellIntegration";
import { useStore } from "./terminalStore";
import type { PaneId, TabId } from "./types";
import { appendOutputCapture } from "./aiHandoff";

interface Props {
  paneId: PaneId;
  tabId: TabId;
}

interface PtyOutputPayload {
  pane_id: string;
  data: number[];
}

// How long after the last input the cursor stops blinking. Matches iTerm2 /
// Warp's behavior — cursor blinks while you're typing, goes steady when idle.
// Cheap and significant: 2 paints/sec while blinking is ~2% of one CPU core.
const BLINK_IDLE_MS = 3000;

function isAppShortcut(e: KeyboardEvent): boolean {
  if (!e.metaKey || e.ctrlKey || e.altKey) return false;
  const k = e.key;
  return (
    k === "t" ||
    k === "w" ||
    k.toLowerCase() === "e" ||
    (e.shiftKey && k.toLowerCase() === "i") ||
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
  const setPaneSelectedText = useStore((s) => s.setPaneSelectedText);
  const handleShellOsc = useStore((s) => s.handleShellOsc);
  // A pane is "active" only when its tab is the active tab AND it's the
  // active pane within that tab. This makes focus follow tab switches.
  const isActive = useStore(
    (s) => s.activeTabId === tabId && s.activePaneByTab[tabId] === paneId
  );

  // Live ref so the main effect's closures can read the current isActive
  // without re-binding the effect on every change.
  const isActiveRef = useRef(isActive);
  isActiveRef.current = isActive;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const term = new Terminal({
      fontFamily:
        '"JetBrains Mono", "SF Mono", "Menlo", "Monaco", monospace',
      fontSize: 13,
      lineHeight: 1.25,
      letterSpacing: 0,
      // Start with blink OFF; the state machine below turns it on only while
      // active + window-focused + recently used.
      cursorBlink: false,
      cursorStyle: "block",
      // Don't paint a cursor at all on unfocused panes — saves a paint cycle
      // for every pane that isn't the active one.
      cursorInactiveStyle: "none",
      allowProposedApi: true,
      scrollback: 10000,
      drawBoldTextInBrightColors: true,
      minimumContrastRatio: 1,
      theme: {
        background: "#0d0e12",
        foreground: "#e6e6ea",
        cursor: "#a78bfa",
        cursorAccent: "#0d0e12",
        selectionBackground: "#4a3d72",
        selectionInactiveBackground: "#322c46",
      },
    });
    termRef.current = term;

    const fit = new FitAddon();
    term.loadAddon(fit);

    // ⌘+click on URLs opens them in the default browser. Plain clicks fall
    // through (no-op) so the user can still select text containing a URL.
    const webLinks = new WebLinksAddon((event, uri) => {
      if (event.metaKey) {
        invoke("open_url", { url: uri }).catch(() => {});
      }
    });
    term.loadAddon(webLinks);

    term.attachCustomKeyEventHandler((e) => !isAppShortcut(e));

    term.open(container);

    const shellIntegration = installShellIntegration(term, paneId, {
      onOsc: (event, outputBoundary) =>
        handleShellOsc(paneId, event, outputBoundary),
    });

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
      invoke("report_renderer", { kind: webgl ? "webgl" : "dom" }).catch(
        () => {}
      );

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

    // ----- Cursor blink state machine ------------------------------------
    // The cursor only blinks when:
    //   1. this pane is the active pane in the active tab, AND
    //   2. the OS window has focus, AND
    //   3. there was input within the last BLINK_IDLE_MS.
    // Otherwise blink is off — which on WebGL means no paint per blink
    // cycle, which drops idle CPU from ~2 % to near zero.
    let lastActivityMs = Date.now();
    let currentBlink = false;

    const evaluateBlink = () => {
      const shouldBlink =
        isActiveRef.current &&
        document.hasFocus() &&
        Date.now() - lastActivityMs < BLINK_IDLE_MS;
      if (shouldBlink !== currentBlink) {
        currentBlink = shouldBlink;
        try {
          term.options.cursorBlink = shouldBlink;
        } catch {}
      }
    };

    const onInputActivity = () => {
      lastActivityMs = Date.now();
      evaluateBlink();
    };

    // Cheap idle check at 2 Hz. Each tick is just date math + a string-set
    // when the boolean flips. The interval itself doesn't dirty any paint.
    const blinkInterval = window.setInterval(evaluateBlink, 500);

    // React to OS-level window focus changes.
    window.addEventListener("focus", evaluateBlink);
    window.addEventListener("blur", evaluateBlink);

    // Initial state
    evaluateBlink();

    const dataDisposable = term.onData((data) => {
      onInputActivity();
      invoke("write_to_pty", { paneId, data }).catch(() => {});
    });

    const selectionDisposable = term.onSelectionChange(() => {
      setPaneSelectedText(paneId, term.getSelection());
    });

    let unlisten: (() => void) | null = null;
    listen<PtyOutputPayload>("pty-output", (event) => {
      if (event.payload.pane_id !== paneId) return;
      const bytes = new Uint8Array(event.payload.data);
      appendOutputCapture(paneId, new TextDecoder().decode(bytes));
      term.write(bytes);
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

    const onMouseDown = () => setActivePane(tabId, paneId);
    container.addEventListener("mousedown", onMouseDown);

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
      window.clearInterval(blinkInterval);
      window.removeEventListener("focus", evaluateBlink);
      window.removeEventListener("blur", evaluateBlink);
      dataDisposable.dispose();
      selectionDisposable.dispose();
      shellIntegration.dispose();
      unlisten?.();
      unlistenExit?.();
      ro.disconnect();
      container.removeEventListener("mousedown", onMouseDown);
      try {
        webgl?.dispose();
      } catch {}
      term.dispose();
      termRef.current = null;
    };
  }, [paneId, tabId, setActivePane, setPaneSelectedText, handleShellOsc]);

  // Focus/blur the xterm based on whether it's the active pane. Blurring
  // inactive panes means cursorInactiveStyle: "none" applies and they
  // stop drawing the cursor entirely.
  useEffect(() => {
    const term = termRef.current;
    if (!term) return;
    if (isActive && document.hasFocus()) {
      const id = requestAnimationFrame(() => term.focus());
      return () => cancelAnimationFrame(id);
    } else {
      term.blur();
    }
  }, [isActive]);

  return (
    <div
      ref={containerRef}
      className={`terminal-pane ${isActive ? "active" : ""}`}
    />
  );
}
