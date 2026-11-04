use std::net::{TcpListener, ToSocketAddrs};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use tauri::{AppHandle, Manager};
use tauri_plugin_shell::process::{CommandChild, CommandEvent};
use tauri_plugin_shell::ShellExt;

use crate::{platform, tray};

const SHUTDOWN_LINE: &[u8] = b"{\"kind\":\"shutdown\"}\n";
const GRACE: Duration = Duration::from_secs(10);

// What the tray shows. `Stopped` is the state after a user Stop: neither starting, ready nor failed.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum HostState {
  Starting,
  Ready,
  Error,
  Stopped,
}

impl HostState {
  pub fn label(self) -> &'static str {
    match self {
      HostState::Starting => "starting",
      HostState::Ready => "ready",
      HostState::Error => "error",
      HostState::Stopped => "stopped",
    }
  }
}

// One spawn of the supervisor. A restart creates a new Run, so late events of an old one are ignored.
struct Run {
  child: Mutex<Option<CommandChild>>,
  pid: u32,
  terminated: AtomicBool,
  stopping: AtomicBool,
  // Descendants seen at the last status event: after a crash they reparent to init and a ppid walk misses them.
  tree: Mutex<Vec<u32>>,
}

pub struct Sidecar {
  run: Mutex<Option<Arc<Run>>>,
  state: Mutex<HostState>,
  quitting: AtomicBool,
  finished: AtomicBool,
}

fn sidecar(app: &AppHandle) -> Arc<Sidecar> {
  app.state::<Arc<Sidecar>>().inner().clone()
}

fn set_state(app: &AppHandle, next: HostState) {
  let host = sidecar(app);
  let mut current = host.state.lock().unwrap();
  if *current != next {
    log::info!("host state {} -> {}", current.label(), next.label());
    *current = next;
  }
  drop(current);
  tray::refresh(app, next);
}

fn is_current(host: &Sidecar, run: &Arc<Run>) -> bool {
  host.run.lock().unwrap().as_ref().is_some_and(|r| Arc::ptr_eq(r, run))
}

// The base directory is the executable directory (ADR-007).
fn base_dir() -> Option<std::path::PathBuf> {
  std::env::current_exe().ok()?.parent().map(|p| p.to_path_buf())
}

// Reads `net` from <base>/config/config.json and probes both ports. Returns the first one already taken.
// No config or no `net` section: nothing to probe, the supervisor reports its own failure.
fn busy_port() -> Option<String> {
  let raw = std::fs::read_to_string(base_dir()?.join("config").join("config.json")).ok()?;
  let net = serde_json::from_str::<serde_json::Value>(&raw).ok()?["net"].clone();
  let bind = net["bind"].as_str()?;
  for key in ["httpsPort", "httpPort"] {
    let Some(port) = net[key].as_u64() else { continue };
    let addr = (bind, port as u16).to_socket_addrs().ok().and_then(|mut a| a.next())?;
    if let Err(e) = TcpListener::bind(addr) {
      return Some(format!("{key} {port} on {bind} is busy ({e})"));
    }
  }
  None
}

// Registers the state and spawns the supervisor once. Later starts come from the tray.
pub fn init(app: &AppHandle) {
  app.manage(Arc::new(Sidecar { run: Mutex::new(None), state: Mutex::new(HostState::Stopped), quitting: AtomicBool::new(false), finished: AtomicBool::new(false) }));
  start(app);
}

// Spawns the supervisor with no arguments: its base directory is the executable directory (ADR-007).
// Does nothing while a run is alive. A busy port ends in `error` without spawning, so nothing can be orphaned.
pub fn start(app: &AppHandle) {
  let host = sidecar(app);
  if host.quitting.load(Ordering::SeqCst) {
    return;
  }
  let mut slot = host.run.lock().unwrap();
  if slot.as_ref().is_some_and(|r| !r.terminated.load(Ordering::SeqCst)) {
    log::info!("sidecar start ignored: already running");
    return;
  }
  if let Some(reason) = busy_port() {
    log::error!("sidecar not started: {reason}");
    drop(slot);
    set_state(app, HostState::Error);
    return;
  }
  let spawned = app.shell().sidecar("sea-runtime").map_err(|e| e.to_string()).and_then(|c| c.spawn().map_err(|e| e.to_string()));
  let (mut rx, child) = match spawned {
    Ok(pair) => pair,
    Err(e) => {
      log::error!("sidecar spawn failed: {e}");
      drop(slot);
      set_state(app, HostState::Error);
      return;
    }
  };
  let run = Arc::new(Run { pid: child.pid(), child: Mutex::new(Some(child)), terminated: AtomicBool::new(false), stopping: AtomicBool::new(false), tree: Mutex::new(Vec::new()) });
  log::info!("sidecar spawned pid={}", run.pid);
  *slot = Some(run.clone());
  drop(slot);
  set_state(app, HostState::Starting);
  let app = app.clone();
  tauri::async_runtime::spawn(async move {
    let host = sidecar(&app);
    while let Some(event) = rx.recv().await {
      match event {
        // ADR-006: one JSON `status` event per stdout line.
        CommandEvent::Stdout(bytes) => {
          let line = String::from_utf8_lossy(&bytes);
          match serde_json::from_str::<serde_json::Value>(&line) {
            Ok(v) if v["kind"] == "status" => {
              log::info!("sidecar status state={}", v["state"]);
              *run.tree.lock().unwrap() = platform::descendants(run.pid);
              if !is_current(&host, &run) || run.stopping.load(Ordering::SeqCst) {
                continue;
              }
              // `stopping` keeps the current state; the Stop path sets `stopped` when the process is gone.
              match v["state"].as_str() {
                Some("starting") => set_state(&app, HostState::Starting),
                Some("ready" | "degraded") => set_state(&app, HostState::Ready),
                Some("error") => set_state(&app, HostState::Error),
                _ => {}
              }
            }
            Ok(v) => log::warn!("sidecar stdout event with unknown kind: {v}"),
            Err(e) => log::warn!("sidecar stdout is not JSON ({e}): {}", line.trim_end()),
          }
        }
        // ADR-006: stderr carries logs only.
        CommandEvent::Stderr(bytes) => log::info!("sidecar log: {}", String::from_utf8_lossy(&bytes).trim_end()),
        CommandEvent::Error(e) => log::error!("sidecar error: {e}"),
        CommandEvent::Terminated(p) => {
          log::info!("sidecar terminated code={:?} signal={:?}", p.code, p.signal);
          run.terminated.store(true, Ordering::SeqCst);
          if run.stopping.load(Ordering::SeqCst) || !is_current(&host, &run) {
            continue;
          }
          // Unexpected end (crash, kill -9, startup failure): free what the supervisor left behind, then show `error`.
          let killed = platform::kill_survivors(run.pid, &run.tree.lock().unwrap());
          log::error!("sidecar ended unexpectedly; killed leftovers {killed:?}; use Start in the tray to run it again");
          set_state(&app, HostState::Error);
        }
        _ => {}
      }
    }
  });
}

// Graceful stop of one run: snapshot the tree, send the shutdown command on stdin, wait for exit, then kill survivors. Blocking.
fn stop_run(run: &Run) {
  // A second caller (Stop then Quit) only waits for the first one.
  if run.stopping.swap(true, Ordering::SeqCst) {
    let t0 = Instant::now();
    while !run.terminated.load(Ordering::SeqCst) && t0.elapsed() < GRACE + Duration::from_secs(2) {
      std::thread::sleep(Duration::from_millis(50));
    }
    return;
  }
  // Snapshot first: once the supervisor exits, its children reparent to the init process and a ppid walk misses them.
  let snapshot = platform::descendants(run.pid);
  log::info!("sidecar stop: root={} descendants={snapshot:?}", run.pid);
  if let Some(child) = run.child.lock().unwrap().as_mut() {
    let _ = child.write(SHUTDOWN_LINE);
  }
  let t0 = Instant::now();
  while !run.terminated.load(Ordering::SeqCst) && t0.elapsed() < GRACE {
    std::thread::sleep(Duration::from_millis(50));
  }
  let killed = platform::kill_survivors(run.pid, &snapshot);
  log::info!("sidecar stop: terminated={} after_ms={} force-killed={killed:?}", run.terminated.load(Ordering::SeqCst), t0.elapsed().as_millis());
}

fn stop_blocking(host: &Sidecar) {
  let run = host.run.lock().unwrap().clone();
  if let Some(run) = run {
    stop_run(&run);
  }
  host.finished.store(true, Ordering::SeqCst);
}

// Tray Stop: runs off the event loop, then shows `stopped`.
pub fn stop(app: &AppHandle) {
  let host = sidecar(app);
  let Some(run) = host.run.lock().unwrap().clone().filter(|r| !r.terminated.load(Ordering::SeqCst)) else { return };
  let app = app.clone();
  std::thread::spawn(move || {
    stop_run(&run);
    if !host.quitting.load(Ordering::SeqCst) {
      set_state(&app, HostState::Stopped);
    }
  });
}

// ExitRequested path and tray Quit: runs on a plain thread so the event loop stays alive, then calls app.exit(0).
pub fn stop_then_exit(app: &AppHandle) {
  let host = sidecar(app);
  if host.quitting.swap(true, Ordering::SeqCst) {
    return;
  }
  let app = app.clone();
  std::thread::spawn(move || {
    stop_blocking(&host);
    app.exit(0);
  });
}

// RunEvent::Exit path: last chance, blocks until the tree is gone.
pub fn stop_on_exit(app: &AppHandle) {
  let Some(host) = app.try_state::<Arc<Sidecar>>().map(|s| s.inner().clone()) else { return };
  if host.finished.load(Ordering::SeqCst) {
    return;
  }
  host.quitting.store(true, Ordering::SeqCst);
  stop_blocking(&host);
}

pub fn is_finished(app: &AppHandle) -> bool {
  app.try_state::<Arc<Sidecar>>().map(|s| s.finished.load(Ordering::SeqCst)).unwrap_or(true)
}
