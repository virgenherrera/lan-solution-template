use std::sync::atomic::{AtomicBool, AtomicU32, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use tauri::{AppHandle, Manager};
use tauri_plugin_shell::process::{CommandChild, CommandEvent};
use tauri_plugin_shell::ShellExt;

use crate::platform;

const SHUTDOWN_LINE: &[u8] = b"{\"kind\":\"shutdown\"}\n";
const GRACE: Duration = Duration::from_secs(10);

#[derive(Default)]
pub struct Sidecar {
  child: Mutex<Option<CommandChild>>,
  pid: AtomicU32,
  terminated: AtomicBool,
  stopping: AtomicBool,
  finished: AtomicBool,
}

// Spawns the supervisor with no arguments: its base directory is the executable directory (ADR-007).
pub fn start(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
  let (mut rx, child) = app.shell().sidecar("sea-runtime")?.spawn()?;
  let state = Arc::new(Sidecar::default());
  state.pid.store(child.pid(), Ordering::SeqCst);
  *state.child.lock().unwrap() = Some(child);
  log::info!("sidecar spawned pid={}", state.pid.load(Ordering::SeqCst));
  app.manage(state.clone());
  tauri::async_runtime::spawn(async move {
    while let Some(event) = rx.recv().await {
      match event {
        // ADR-006: one JSON `status` event per stdout line.
        CommandEvent::Stdout(bytes) => {
          let line = String::from_utf8_lossy(&bytes);
          match serde_json::from_str::<serde_json::Value>(&line) {
            Ok(v) if v["kind"] == "status" => log::info!("sidecar status state={}", v["state"]),
            Ok(v) => log::warn!("sidecar stdout event with unknown kind: {v}"),
            Err(e) => log::warn!("sidecar stdout is not JSON ({e}): {}", line.trim_end()),
          }
        }
        // ADR-006: stderr carries logs only.
        CommandEvent::Stderr(bytes) => log::info!("sidecar log: {}", String::from_utf8_lossy(&bytes).trim_end()),
        CommandEvent::Error(e) => log::error!("sidecar error: {e}"),
        CommandEvent::Terminated(p) => {
          log::info!("sidecar terminated code={:?} signal={:?}", p.code, p.signal);
          state.terminated.store(true, Ordering::SeqCst);
        }
        _ => {}
      }
    }
  });
  Ok(())
}

// Graceful stop: snapshot the tree, send the shutdown command on stdin, wait for exit, then kill survivors. Blocking.
fn stop_blocking(state: &Sidecar) {
  let pid = state.pid.load(Ordering::SeqCst);
  // Snapshot first: once the supervisor exits, its children reparent to the init process and a ppid walk misses them.
  let snapshot = platform::descendants(pid);
  log::info!("sidecar stop: root={pid} descendants={snapshot:?}");
  if let Some(child) = state.child.lock().unwrap().as_mut() {
    let _ = child.write(SHUTDOWN_LINE);
  }
  let t0 = Instant::now();
  while !state.terminated.load(Ordering::SeqCst) && t0.elapsed() < GRACE {
    std::thread::sleep(Duration::from_millis(50));
  }
  let killed = platform::kill_survivors(pid, &snapshot);
  log::info!("sidecar stop: terminated={} after_ms={} force-killed={killed:?}", state.terminated.load(Ordering::SeqCst), t0.elapsed().as_millis());
  state.finished.store(true, Ordering::SeqCst);
}

// ExitRequested path: runs on a plain thread so the event loop stays alive, then calls app.exit(0).
pub fn stop_then_exit(app: &AppHandle) {
  let Some(state) = app.try_state::<Arc<Sidecar>>() else { return };
  let state: Arc<Sidecar> = state.inner().clone();
  if state.stopping.swap(true, Ordering::SeqCst) {
    return;
  }
  let app = app.clone();
  std::thread::spawn(move || {
    stop_blocking(&state);
    app.exit(0);
  });
}

// RunEvent::Exit path: last chance, blocks until the tree is gone.
pub fn stop_on_exit(app: &AppHandle) {
  let Some(state) = app.try_state::<Arc<Sidecar>>() else { return };
  if state.finished.load(Ordering::SeqCst) || state.stopping.swap(true, Ordering::SeqCst) {
    return;
  }
  stop_blocking(&state);
}

pub fn is_finished(app: &AppHandle) -> bool {
  app.try_state::<Arc<Sidecar>>().map(|s| s.finished.load(Ordering::SeqCst)).unwrap_or(true)
}
