// The main window is a plain WebView on the gateway origin (AC-18). Tauri hosts no SPA of its own.
// The window gets no IPC: no capability file exists and no `remote` URL is declared (REQ-SEC-05).
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};

use crate::sidecar::{self, HostState};
use crate::trust;

const WINDOW: &str = "main";

// The gateway always certifies 127.0.0.1 (see generate-certs), whatever interface `net.bind` names.
fn origin() -> Option<tauri::Url> {
  let port = sidecar::https_port()?;
  format!("https://127.0.0.1:{port}/").parse().ok()
}

// Shows the window, creating it first when the gateway is ready. Nothing to show before that.
pub fn show(app: &AppHandle) {
  if let Some(window) = app.get_webview_window(WINDOW) {
    let _ = window.show();
    let _ = window.unminimize();
    let _ = window.set_focus();
    log::info!("window shown");
  } else if sidecar::state(app) == HostState::Ready {
    open(app);
  } else {
    log::info!("window not created: gateway is not ready");
  }
}

// Called when the supervisor reports ready: creates the window on the gateway origin, or reloads a hidden one.
pub fn on_ready(app: &AppHandle) {
  if !trust::is_trusted() {
    log::warn!("the OS does not trust ca.crt: the window cannot load the gateway until the tray item Trust CA... installs it");
  }
  open(app);
}

fn open(app: &AppHandle) {
  let Some(url) = origin() else {
    log::error!("window not created: no httpsPort in config/config.json");
    return;
  };
  let handle = app.clone();
  let _ = app.run_on_main_thread(move || {
    if let Some(window) = handle.get_webview_window(WINDOW) {
      match window.navigate(url.clone()) {
        Ok(()) => log::info!("window reloaded url={url}"),
        Err(e) => log::error!("window reload failed: {e}"),
      }
      return;
    }
    let built = WebviewWindowBuilder::new(&handle, WINDOW, WebviewUrl::External(url.clone())).title("LAN Solution").inner_size(800.0, 600.0).build();
    match built {
      Ok(_) => log::info!("window created url={url}"),
      Err(e) => log::error!("window creation failed: {e}"),
    }
  });
}
