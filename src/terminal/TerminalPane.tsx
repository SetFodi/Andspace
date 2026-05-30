import { useEffect, useRef, useState } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebglAddon } from "@xterm/addon-webgl";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { installShellIntegration } from "./shellIntegration";
import { useStore } from "./terminalStore";
import type { PaneId, TabId } from "./types";
import { appendOutputCaptureBytes } from "./aiHandoff";
import { hasServerDetectionTail, useServerStore } from "./serverStore";
import { usePreferencesStore } from "./preferencesStore";
import {
  scrollbackRowsForProfile,
  xtermThemeForPreference,
} from "./preferencesModel";
import { normalizeLocalPreviewUrl } from "./localPreview";

interface Props {
  paneId: PaneId;
  tabId: TabId;
}

interface PtyOutputPayload {
  pane_id: string;
  data: string | number[];
  encoding?: "base64";
}

// How long after the last input the cursor stops blinking. Matches iTerm2 /
// Warp's behavior — cursor blinks while you're typing, goes steady when idle.
// Cheap and significant: 2 paints/sec while blinking is ~2% of one CPU core.
const BLINK_IDLE_MS = 3000;
const MAX_XTERM_WRITE_BATCH_BYTES = 128 * 1024;

type RepairOptions = {
  resize?: boolean;
  clearAtlas?: boolean;
};

type LinkHint = {
  x: number;
  y: number;
  title: string;
  preview?: boolean;
};

function isAppShortcut(e: KeyboardEvent): boolean {
  if (!e.metaKey || e.ctrlKey) return false;
  const k = e.key;

  if (e.altKey) return false;

  return (
    (k === "t" && !e.shiftKey) ||
    (k === "w" && !e.shiftKey) ||
    (k.toLowerCase() === "o" && !e.shiftKey) ||
    (k.toLowerCase() === "l" && !e.shiftKey) ||
    (k.toLowerCase() === "b" && !e.shiftKey) ||
    (k.toLowerCase() === "k" && !e.shiftKey) ||
    (k.toLowerCase() === "e" && !e.shiftKey) ||
    (k.toLowerCase() === "p" && !e.shiftKey) ||
    (k === "," && !e.shiftKey) ||
    (e.shiftKey && k.toLowerCase() === "i") ||
    (k === "0" && !e.shiftKey) ||
    (k === "[" && !e.shiftKey) ||
    (k === "]" && !e.shiftKey) ||
    (k === "ArrowLeft" && !e.shiftKey) ||
    (k === "ArrowRight" && !e.shiftKey) ||
    (k === "ArrowUp" && !e.shiftKey) ||
    (k === "ArrowDown" && !e.shiftKey) ||
    k === "/" ||
    k === "?" ||
    (/^[1-9]$/.test(k) && !e.shiftKey)
  );
}

function containsServerScanMarker(bytes: Uint8Array): boolean {
  for (let i = 0; i < bytes.length; i++) {
    const b = asciiLower(bytes[i]);
    if (
      (b === 104 && matchesAsciiAt(bytes, i, "http")) ||
      (b === 108 &&
        (matchesAsciiAt(bytes, i, "localhost") ||
          matchesAsciiAt(bytes, i, "local:"))) ||
      (b === 49 &&
        (matchesAsciiAt(bytes, i, "127.") ||
          matchesAsciiAt(bytes, i, "192.168."))) ||
      (b === 48 && matchesAsciiAt(bytes, i, "0.0.0.0")) ||
      (b === 118 && matchesAsciiAt(bytes, i, "vite")) ||
      (b === 110 &&
        (matchesAsciiAt(bytes, i, "next") ||
          matchesAsciiAt(bytes, i, "nestjs") ||
          matchesAsciiAt(bytes, i, "network:"))) ||
      (b === 97 && matchesAsciiAt(bytes, i, "astro")) ||
      (b === 115 && matchesAsciiAt(bytes, i, "storybook"))
    ) {
      return true;
    }
  }
  return false;
}

function matchesAsciiAt(bytes: Uint8Array, offset: number, value: string): boolean {
  if (offset + value.length > bytes.length) return false;
  for (let i = 0; i < value.length; i++) {
    if (asciiLower(bytes[offset + i]) !== value.charCodeAt(i)) {
      return false;
    }
  }
  return true;
}

function asciiLower(byte: number): number {
  return byte >= 65 && byte <= 90 ? byte + 32 : byte;
}

function takeWriteBatch(queue: Uint8Array[]): Uint8Array | null {
  const first = queue.shift();
  if (!first) return null;
  if (first.length >= MAX_XTERM_WRITE_BATCH_BYTES || queue.length === 0) {
    return first;
  }

  const chunks = [first];
  let total = first.length;
  while (queue.length > 0) {
    const next = queue[0];
    if (total + next.length > MAX_XTERM_WRITE_BATCH_BYTES) break;
    chunks.push(queue.shift()!);
    total += next.length;
  }

  const batch = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    batch.set(chunk, offset);
    offset += chunk.length;
  }
  return batch;
}

function decodePtyPayload(payload: PtyOutputPayload): Uint8Array {
  if (typeof payload.data !== "string") {
    return new Uint8Array(payload.data);
  }
  if (payload.encoding === "base64") {
    const fromBase64 = (
      Uint8Array as unknown as {
        fromBase64?: (value: string) => Uint8Array;
      }
    ).fromBase64;
    if (typeof fromBase64 === "function") {
      return fromBase64(payload.data);
    }
    const binary = atob(payload.data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }
  return new TextEncoder().encode(payload.data);
}

export function TerminalPane({ paneId, tabId }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const setActivePane = useStore((s) => s.setActivePane);
  const setPaneSelectedText = useStore((s) => s.setPaneSelectedText);
  const handleShellOsc = useStore((s) => s.handleShellOsc);
  // A pane is "active" only when its tab is the active tab AND it's the
  // active pane within that tab. This makes focus follow tab switches.
  const isActive = useStore(
    (s) => s.activeTabId === tabId && s.activePaneByTab[tabId] === paneId
  );
  const terminalFontSize = usePreferencesStore(
    (s) => s.preferences.terminal.fontSize
  );
  const scrollbackProfile = usePreferencesStore(
    (s) => s.preferences.terminal.scrollbackProfile
  );
  const themePreference = usePreferencesStore((s) => s.preferences.theme);
  const [linkHint, setLinkHint] = useState<LinkHint | null>(null);

  // Live ref so the main effect's closures can read the current isActive
  // without re-binding the effect on every change.
  const isActiveRef = useRef(isActive);
  isActiveRef.current = isActive;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const term = new Terminal({
      fontFamily:
        '"JetBrainsMono Nerd Font Mono", "JetBrains Mono", "SF Mono", "Menlo", "Monaco", monospace',
      fontSize: terminalFontSize,
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
      scrollback: scrollbackRowsForProfile(scrollbackProfile),
      drawBoldTextInBrightColors: true,
      minimumContrastRatio: 1,
      theme: xtermThemeForPreference(themePreference),
    });
    termRef.current = term;

    const fit = new FitAddon();
    fitRef.current = fit;
    term.loadAddon(fit);

    const webLinks = new WebLinksAddon(
      (event, uri) => {
        if (!event.metaKey) return;
        event.preventDefault();
        setLinkHint(null);

        const localUrl = normalizeLocalPreviewUrl(uri);
        if (localUrl && !event.shiftKey) {
          window.dispatchEvent(
            new CustomEvent("andspace:preview-url", {
              detail: { url: localUrl },
            })
          );
          return;
        }

        invoke("open_url", { url: localUrl ?? uri }).catch(() => {});
      },
      {
        hover(event, uri) {
          const localUrl = normalizeLocalPreviewUrl(uri);
          setLinkHint({
            x: event.clientX,
            y: event.clientY,
            title: localUrl ? "Preview local app" : "Open link",
            preview: Boolean(localUrl),
          });
        },
        leave() {
          setLinkHint(null);
        },
      }
    );
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
    let repairFrame: number | null = null;

    const resizePtyToTerminal = () => {
      invoke("resize_pty", {
        paneId,
        cols: term.cols,
        rows: term.rows,
      }).catch(() => {});
    };

    const repairTerminalRender = (options: RepairOptions = {}) => {
      if (cancelled) return;
      if (repairFrame !== null) {
        cancelAnimationFrame(repairFrame);
      }
      repairFrame = requestAnimationFrame(() => {
        repairFrame = requestAnimationFrame(() => {
          repairFrame = null;
          if (cancelled) return;
          try {
            if (options.resize) {
              fit.fit();
              resizePtyToTerminal();
            }
            if (options.clearAtlas) {
              webgl?.clearTextureAtlas();
            }
            term.refresh(0, Math.max(0, term.rows - 1));
          } catch {
            // xterm may already be disposed while a deferred repair is queued.
          }
        });
      });
    };

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

      // If the Nerd Font finishes loading after xterm has already initialized
      // its glyph atlas, clear the atlas + force a redraw so icons render
      // with the correct glyphs instead of missing-glyph boxes.
      if (document.fonts?.load) {
        Promise.all([
          document.fonts.load('400 1em "JetBrainsMono Nerd Font Mono"'),
          document.fonts.load('700 1em "JetBrainsMono Nerd Font Mono"'),
          document.fonts.ready,
        ])
          .then(() => repairTerminalRender({ resize: true, clearAtlas: true }))
          .catch(() => {});
      }

      // Diagnostic — write the chosen renderer to /tmp/andspace-diag.log so we
      // can verify which path is active without devtools.
      const rendererKind = webgl ? "webgl" : "dom";
      window.dispatchEvent(
        new CustomEvent("andspace:renderer", { detail: { kind: rendererKind } })
      );
      invoke("report_renderer", { kind: rendererKind }).catch(() => {});

      resizePtyToTerminal();

      // Force a paint — WebGL renderer sometimes skips its first frame
      // if the container size changed between open() and load().
      repairTerminalRender({ clearAtlas: true });
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
    const onRefocusTerminal = () => {
      if (isActiveRef.current && document.hasFocus()) {
        term.focus();
        repairTerminalRender({ resize: true, clearAtlas: true });
      }
    };
    window.addEventListener("andspace-refocus-terminal", onRefocusTerminal);

    // Initial state
    evaluateBlink();

    const activatePane = () => setActivePane(tabId, paneId);

    const dataDisposable = term.onData((data) => {
      activatePane();
      onInputActivity();
      invoke("write_to_pty", { paneId, data }).catch(() => {});
    });

    const selectionDisposable = term.onSelectionChange(() => {
      setPaneSelectedText(paneId, term.getSelection());
    });

    let unlisten: (() => void) | null = null;
    const writeQueue: Uint8Array[] = [];
    let isWritingToTerminal = false;
    let unackedTerminalBytes = 0;

    const ackTerminalBytes = (bytes: number) => {
      if (bytes <= 0) return;
      unackedTerminalBytes = Math.max(0, unackedTerminalBytes - bytes);
      invoke("ack_pty_output", { paneId, bytes }).catch(() => {});
    };

    const pumpTerminalWriteQueue = () => {
      if (cancelled || isWritingToTerminal) return;
      const batch = takeWriteBatch(writeQueue);
      if (!batch) return;

      isWritingToTerminal = true;
      term.write(batch, () => {
        isWritingToTerminal = false;
        ackTerminalBytes(batch.length);
        pumpTerminalWriteQueue();
      });
    };

    const enqueueTerminalWrite = (bytes: Uint8Array) => {
      const last = writeQueue[writeQueue.length - 1];
      if (last && last.length + bytes.length <= MAX_XTERM_WRITE_BATCH_BYTES) {
        const merged = new Uint8Array(last.length + bytes.length);
        merged.set(last, 0);
        merged.set(bytes, last.length);
        writeQueue[writeQueue.length - 1] = merged;
      } else {
        writeQueue.push(bytes);
      }
      pumpTerminalWriteQueue();
    };

    listen<PtyOutputPayload>("pty-output", (event) => {
      if (event.payload.pane_id !== paneId) return;
      const bytes = decodePtyPayload(event.payload);
      unackedTerminalBytes += bytes.length;
      appendOutputCaptureBytes(paneId, bytes);
      // Server detection runs off the same byte stream, but only decode chunks
      // that can plausibly contain a local server URL/banner. Heavy terminal
      // output should not pay a UTF-8 decode + regex scan per PTY chunk.
      if (
        hasServerDetectionTail(paneId) ||
        containsServerScanMarker(bytes)
      ) {
        const text = new TextDecoder().decode(bytes);
        useServerStore.getState().ingestPaneOutput(paneId, text);
      }
      enqueueTerminalWrite(bytes);
    }).then((fn) => {
      unlisten = fn;
    });

    let unlistenExit: (() => void) | null = null;
    listen<string>("pty-exit", (event) => {
      if (event.payload !== paneId) return;
      enqueueTerminalWrite(
        new TextEncoder().encode("\r\n\x1b[2m[process exited]\x1b[0m\r\n")
      );
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
        resizePtyToTerminal();
        repairTerminalRender();
      } catch {}
    };

    const ro = new ResizeObserver(syncSize);
    ro.observe(container);
    window.addEventListener("resize", syncSize);

    const paneSlot = container.closest(".pane-slot");
    paneSlot?.addEventListener("transitionend", syncSize);
    paneSlot?.addEventListener("animationend", syncSize);

    container.addEventListener("pointerdown", activatePane, true);
    container.addEventListener("focusin", activatePane);

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
      if (repairFrame !== null) cancelAnimationFrame(repairFrame);
      window.clearInterval(blinkInterval);
      window.removeEventListener("focus", evaluateBlink);
      window.removeEventListener("blur", evaluateBlink);
      window.removeEventListener("andspace-refocus-terminal", onRefocusTerminal);
      window.removeEventListener("resize", syncSize);
      dataDisposable.dispose();
      selectionDisposable.dispose();
      shellIntegration.dispose();
      unlisten?.();
      unlistenExit?.();
      ackTerminalBytes(unackedTerminalBytes);
      ro.disconnect();
      paneSlot?.removeEventListener("transitionend", syncSize);
      paneSlot?.removeEventListener("animationend", syncSize);
      container.removeEventListener("pointerdown", activatePane, true);
      container.removeEventListener("focusin", activatePane);
      try {
        webgl?.dispose();
      } catch {}
      term.dispose();
      termRef.current = null;
      fitRef.current = null;
    };
  }, [paneId, tabId, setActivePane, setPaneSelectedText, handleShellOsc]);

  useEffect(() => {
    const term = termRef.current;
    if (!term) return;
    term.options.fontSize = terminalFontSize;
    term.options.scrollback = scrollbackRowsForProfile(scrollbackProfile);
    term.options.theme = xtermThemeForPreference(themePreference);
    try {
      fitRef.current?.fit();
      invoke("resize_pty", {
        paneId,
        cols: term.cols,
        rows: term.rows,
      }).catch(() => {});
      term.refresh(0, Math.max(0, term.rows - 1));
    } catch {}
  }, [paneId, scrollbackProfile, terminalFontSize, themePreference]);

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

  // External focus requests (e.g. Esc from the sidebar). Only the active
  // pane responds so we don't fight focus when multiple panes mount.
  useEffect(() => {
    const onFocusRequest = () => {
      const term = termRef.current;
      if (!term || !isActiveRef.current) return;
      term.focus();
    };
    window.addEventListener("andspace:focus-terminal", onFocusRequest);
    return () =>
      window.removeEventListener("andspace:focus-terminal", onFocusRequest);
  }, []);

  return (
    <div
      className={`terminal-pane ${isActive ? "active" : ""}`}
      onPointerDownCapture={() => setActivePane(tabId, paneId)}
    >
      <div ref={containerRef} className="terminal-host" />
      {linkHint && (
        <div
          className="terminal-link-hint"
          style={{
            left: Math.max(
              8,
              Math.min(linkHint.x + 12, window.innerWidth - 376)
            ),
            top: Math.max(8, linkHint.y - 34),
          }}
        >
          <strong>{linkHint.title}</strong>
          {linkHint.preview ? (
            <span className="terminal-link-hint-actions">
              <span className="terminal-link-hint-action">
                <kbd>⌘</kbd>
                <em>Preview in AndSpace</em>
              </span>
              <span className="terminal-link-hint-action">
                <kbd>⇧</kbd>
                <kbd>⌘</kbd>
                <em>Open browser</em>
              </span>
            </span>
          ) : (
            <span className="terminal-link-hint-actions">
              <span className="terminal-link-hint-action">
                <kbd>⌘</kbd>
                <em>Open browser</em>
              </span>
            </span>
          )}
        </div>
      )}
    </div>
  );
}
