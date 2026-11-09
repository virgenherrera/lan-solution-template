// The main window is a plain WebView on the gateway origin (AC-18). Tauri hosts no SPA of its own: the only local page is the static startup splash (splash/index.html), shown until the gateway is ready.
// The window gets no IPC: no capability file exists and no `remote` URL is declared (REQ-SEC-05).
use tauri::webview::NewWindowResponse;
use tauri::{AppHandle, Manager, Url, WebviewUrl, WebviewWindowBuilder};

use crate::sidecar::{self, HostState};
use crate::trust;

const WINDOW: &str = "main";

// The gateway always certifies 127.0.0.1 (see generate-certs), whatever interface `net.bind` names.
fn origin() -> Option<Url> {
  let port = sidecar::https_port()?;
  format!("https://127.0.0.1:{port}/").parse().ok()
}

// The WebView may only stay on the gateway origin: same scheme, host and port (A2). The page CSP is set by the gateway response headers, not by Tauri.
fn same_origin(url: &Url, allowed: &Url) -> bool {
  url.scheme() == allowed.scheme() && url.host_str() == allowed.host_str() && url.port_or_known_default() == allowed.port_or_known_default()
}

// Log form of a denied URL: never the query, the fragment or credentials.
fn loggable(url: &Url) -> String {
  let host = url.host_str().unwrap_or("");
  let port = url.port().map(|p| format!(":{p}")).unwrap_or_default();
  format!("{}://{host}{port}{}", url.scheme(), url.path())
}

// The splash is exactly the bundled page of the host itself: tauri://localhost/index.html, or http://tauri.localhost/index.html on Windows. Any other path, port or credentials on those origins is not the splash.
fn is_splash(url: &Url) -> bool {
  let origin_ok = matches!((url.scheme(), url.host_str()), ("tauri", Some("localhost")) | ("http", Some("tauri.localhost")));
  origin_ok && url.port().is_none() && url.username().is_empty() && url.password().is_none() && url.path() == "/index.html"
}

// Builds the main window on `url`. The filter allows the splash page and, once the port is known, the gateway origin (A2); the gateway origin is read at navigation time because the window outlives the splash.
fn build(app: &AppHandle, url: WebviewUrl) {
  let built = WebviewWindowBuilder::new(app, WINDOW, url)
    .title("LAN Solution")
    .inner_size(800.0, 600.0)
    .on_navigation(|target| {
      let ok = is_splash(target) || origin().is_some_and(|allowed| same_origin(target, &allowed));
      if !ok {
        log::warn!("navigation blocked url={}", loggable(target));
      }
      ok
    })
    .on_new_window(|target, _features| {
      log::warn!("new window blocked url={}", loggable(&target));
      NewWindowResponse::Deny
    })
    .build();
  match built {
    Ok(_) => log::info!("window created"),
    Err(e) => log::error!("window creation failed: {e}"),
  }
}

// Creates the main window on the splash at start. `open` later navigates this same window to the gateway origin.
pub fn show_splash(app: &AppHandle) {
  let handle = app.clone();
  let _ = app.run_on_main_thread(move || {
    build(&handle, WebviewUrl::App("index.html".into()));
    log::info!("splash shown");
  });
}

// Shows the window, creating it first when the gateway is ready. Before that the splash window is shown.
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
    build(&handle, WebviewUrl::External(url.clone()));
    log::info!("window created url={url}");
  });
}
