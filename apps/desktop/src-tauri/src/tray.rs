// Tray icon and menu (REQ-DESK-03), autostart checkbox (REQ-DESK-04) and the main window shown/hidden from the tray.
use std::sync::Arc;

use tauri::menu::{CheckMenuItem, Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::TrayIconBuilder;
use tauri::{AppHandle, Manager, Wry};
use tauri_plugin_autostart::ManagerExt;

use crate::sidecar::{self, HostState};

const TRAY_ID: &str = "main";

struct Items {
  status: MenuItem<Wry>,
  start: MenuItem<Wry>,
  stop: MenuItem<Wry>,
}

pub fn show_window(app: &AppHandle) {
  if let Some(window) = app.get_webview_window("main") {
    let _ = window.show();
    let _ = window.unminimize();
    let _ = window.set_focus();
    log::info!("window shown");
  }
}

// Autostart is opt-in and off by default (OQ12). The OS entry (LaunchAgent, registry key, .desktop file) is the persisted choice.
fn toggle_autostart(app: &AppHandle, item: &CheckMenuItem<Wry>) {
  let autolaunch = app.autolaunch();
  let result = if autolaunch.is_enabled().unwrap_or(false) { autolaunch.disable() } else { autolaunch.enable() };
  if let Err(e) = result {
    log::error!("autostart change failed: {e}");
  }
  let enabled = autolaunch.is_enabled().unwrap_or(false);
  let _ = item.set_checked(enabled);
  log::info!("autostart enabled={enabled}");
}

pub fn init(app: &AppHandle) -> tauri::Result<()> {
  let status = MenuItem::with_id(app, "status", "Status: starting", false, None::<&str>)?;
  let open = MenuItem::with_id(app, "open", "Open UI", true, None::<&str>)?;
  let start = MenuItem::with_id(app, "start", "Start", false, None::<&str>)?;
  let stop = MenuItem::with_id(app, "stop", "Stop", true, None::<&str>)?;
  let autostart = CheckMenuItem::with_id(app, "autostart", "Start at login", true, app.autolaunch().is_enabled().unwrap_or(false), None::<&str>)?;
  let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
  let sep = PredefinedMenuItem::separator(app)?;
  let menu = Menu::with_items(app, &[&status, &sep, &open, &start, &stop, &autostart, &sep, &quit])?;
  let mut builder = TrayIconBuilder::with_id(TRAY_ID).menu(&menu).tooltip("LAN Solution: starting").on_menu_event(move |app, event| match event.id().as_ref() {
    "open" => show_window(app),
    "start" => sidecar::start(app),
    "stop" => sidecar::stop(app),
    "autostart" => toggle_autostart(app, &autostart),
    "quit" => sidecar::stop_then_exit(app),
    _ => {}
  });
  if let Some(icon) = app.default_window_icon() {
    builder = builder.icon(icon.clone());
  }
  builder.build(app)?;
  app.manage(Arc::new(Items { status, start, stop }));
  Ok(())
}

// Called on every host state change, from any thread.
pub fn refresh(app: &AppHandle, state: HostState) {
  let Some(items) = app.try_state::<Arc<Items>>() else { return };
  let _ = items.status.set_text(format!("Status: {}", state.label()));
  let can_start = matches!(state, HostState::Error | HostState::Stopped);
  let _ = items.start.set_enabled(can_start);
  let _ = items.stop.set_enabled(!can_start);
  if let Some(tray) = app.tray_by_id(TRAY_ID) {
    let _ = tray.set_tooltip(Some(format!("LAN Solution: {}", state.label())));
  }
}
