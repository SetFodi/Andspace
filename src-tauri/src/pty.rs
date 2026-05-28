use std::collections::HashMap;
use std::fs::OpenOptions;
use std::io::{Read, Write};
use std::sync::Arc;
use std::thread;
use std::time::{SystemTime, UNIX_EPOCH};

/// Append a single timestamped line to /tmp/andspace-diag.log. Used to verify
/// PTY lifecycle (create / kill / natural exit) and renderer choice without
/// needing devtools. Cheap and best-effort; if the file can't be opened we
/// just skip — diagnostics must never break the app.
pub fn diag_log(line: &str) {
    let ts = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    if let Ok(mut f) = OpenOptions::new()
        .create(true)
        .append(true)
        .open("/tmp/andspace-diag.log")
    {
        let _ = writeln!(f, "{ts} {line}");
    }
}

use parking_lot::Mutex;
use portable_pty::{native_pty_system, CommandBuilder, MasterPty, PtySize};
use serde::Serialize;
use tauri::{AppHandle, Emitter};

struct PtyHandle {
    writer: Box<dyn Write + Send>,
    master: Box<dyn MasterPty + Send>,
    child: Box<dyn portable_pty::Child + Send + Sync>,
}

pub struct PtyManager {
    panes: Arc<Mutex<HashMap<String, PtyHandle>>>,
}

#[derive(Serialize, Clone)]
struct PtyOutputPayload {
    pane_id: String,
    data: Vec<u8>,
}

impl PtyManager {
    pub fn new() -> Self {
        Self {
            panes: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub fn create(
        &self,
        app: AppHandle,
        cols: u16,
        rows: u16,
    ) -> Result<String, String> {
        let pty_system = native_pty_system();
        let pair = pty_system
            .openpty(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| format!("openpty failed: {e}"))?;

        let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".to_string());
        let mut cmd = CommandBuilder::new(shell);
        if let Ok(home) = std::env::var("HOME") {
            cmd.cwd(home);
        }
        cmd.env("TERM", "xterm-256color");
        cmd.env("COLORTERM", "truecolor");
        cmd.env("TERM_PROGRAM", "AndSpace");
        cmd.env("ANDSPACE_SHELL_INTEGRATION", "1");
        if let Some(path) = zsh_integration_path() {
            cmd.env("ANDSPACE_ZSH_INTEGRATION", path);
        }

        let child = pair
            .slave
            .spawn_command(cmd)
            .map_err(|e| format!("spawn failed: {e}"))?;
        let child_pid = child.process_id().unwrap_or(0);
        // Close slave end in this process; the child has its own copy.
        drop(pair.slave);

        let writer = pair
            .master
            .take_writer()
            .map_err(|e| format!("take_writer failed: {e}"))?;
        let mut reader = pair
            .master
            .try_clone_reader()
            .map_err(|e| format!("clone_reader failed: {e}"))?;

        let pane_id = make_id();
        diag_log(&format!("pty-create pid={child_pid} pane={pane_id}"));

        let pane_id_for_thread = pane_id.clone();
        let pid_for_thread = child_pid;
        let app_for_thread = app.clone();
        let panes_for_thread = self.panes.clone();

        // Blocking read loop on its own thread. Each chunk is forwarded
        // to the frontend via the `pty-output` event. On EOF / error,
        // emits `pty-exit` and removes the pane.
        thread::spawn(move || {
            let mut buf = [0u8; 8192];
            loop {
                match reader.read(&mut buf) {
                    Ok(0) => break,
                    Ok(n) => {
                        let payload = PtyOutputPayload {
                            pane_id: pane_id_for_thread.clone(),
                            data: buf[..n].to_vec(),
                        };
                        let _ = app_for_thread.emit("pty-output", payload);
                    }
                    Err(_) => break,
                }
            }
            let _ = app_for_thread.emit("pty-exit", pane_id_for_thread.clone());
            panes_for_thread.lock().remove(&pane_id_for_thread);
            diag_log(&format!(
                "pty-natural-exit pid={pid_for_thread} pane={pane_id_for_thread}"
            ));
        });

        let handle = PtyHandle {
            writer,
            master: pair.master,
            child,
        };
        self.panes.lock().insert(pane_id.clone(), handle);
        Ok(pane_id)
    }

    pub fn write(&self, pane_id: &str, data: &str) -> Result<(), String> {
        let mut panes = self.panes.lock();
        let h = panes.get_mut(pane_id).ok_or("pane not found")?;
        h.writer
            .write_all(data.as_bytes())
            .map_err(|e| e.to_string())?;
        h.writer.flush().map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn resize(&self, pane_id: &str, cols: u16, rows: u16) -> Result<(), String> {
        let panes = self.panes.lock();
        let h = panes.get(pane_id).ok_or("pane not found")?;
        h.master
            .resize(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn kill(&self, pane_id: &str) -> Result<(), String> {
        let mut panes = self.panes.lock();
        if let Some(mut h) = panes.remove(pane_id) {
            let pid = h.child.process_id().unwrap_or(0);
            let _ = h.child.kill();
            let _ = h.child.wait();
            diag_log(&format!("pty-kill pid={pid} pane={pane_id}"));
        }
        Ok(())
    }
}

fn zsh_integration_path() -> Option<String> {
    let path = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("shell-integration/andspace.zsh");
    if path.exists() {
        path.canonicalize()
            .ok()
            .map(|p| p.display().to_string())
    } else {
        None
    }
}

fn make_id() -> String {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    format!("p-{nanos:x}")
}

impl Drop for PtyManager {
    /// Best-effort cleanup of remaining PTYs when the app exits. `try_lock`
    /// avoids deadlocking with a reader thread that's mid-cleanup; if the
    /// lock can't be acquired, the OS will SIGHUP the children on process
    /// exit anyway.
    fn drop(&mut self) {
        if let Some(mut panes) = self.panes.try_lock() {
            for (pane_id, h) in panes.iter_mut() {
                let pid = h.child.process_id().unwrap_or(0);
                let _ = h.child.kill();
                diag_log(&format!("pty-drop pid={pid} pane={pane_id}"));
            }
        }
    }
}
