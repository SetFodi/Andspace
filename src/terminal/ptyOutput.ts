// Per-pane PTY output router.
//
// PTY bytes arrive over a Tauri Channel that is created in the store at spawn
// time — which can be before the React <TerminalPane> for that pane has mounted
// and subscribed. To guarantee no shell output is ever dropped, bytes for a
// pane are buffered here until a subscriber attaches, then flushed in order.
//
// This replaces the old `emit("pty-output")` broadcast (which base64-encoded
// every chunk into a JSON event); the channel delivers raw ArrayBuffers.

type PtyOutputHandler = (bytes: Uint8Array) => void;

const handlers = new Map<string, PtyOutputHandler>();
const buffers = new Map<string, Uint8Array[]>();

/** Route a chunk to the pane's subscriber, or buffer it until one attaches. */
export function pushPtyOutput(paneId: string, bytes: Uint8Array): void {
  const handler = handlers.get(paneId);
  if (handler) {
    handler(bytes);
    return;
  }
  let buffered = buffers.get(paneId);
  if (!buffered) {
    buffered = [];
    buffers.set(paneId, buffered);
  }
  buffered.push(bytes);
}

/**
 * Attach the pane's output handler. Any bytes that arrived before this call are
 * flushed synchronously, in order, before returning. Returns an unsubscribe.
 */
export function subscribePtyOutput(
  paneId: string,
  handler: PtyOutputHandler
): () => void {
  handlers.set(paneId, handler);
  const buffered = buffers.get(paneId);
  if (buffered) {
    buffers.delete(paneId);
    for (const chunk of buffered) handler(chunk);
  }
  return () => {
    if (handlers.get(paneId) === handler) {
      handlers.delete(paneId);
    }
  };
}

/** Drop any subscriber and buffered bytes for a pane (on kill / teardown). */
export function clearPtyOutput(paneId: string): void {
  handlers.delete(paneId);
  buffers.delete(paneId);
}
