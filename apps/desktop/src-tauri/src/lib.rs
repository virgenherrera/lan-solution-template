mod gateway;
mod platform;
mod sidecar;
mod tray;
mod trust;

use tauri::{RunEvent, WindowEvent};
use tauri_plugin_autostart::MacosLauncher;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  // The single-instance plugin must be the first one (REQ-DESK-05): the second launch only shows the first window, then exits.
  let builder = tauri::Builder::default().plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| tray::show_window(app)));
  // Only the instrumented E2E build (cargo feature wdio) registers the WebDriver plugins (REQ-TEST-08, AC-20); the product never does.
  #[cfg(feature = "wdio")]
  let builder = builder.plugin(tauri_plugin_wdio::init()).plugin(tauri_plugin_wdio_webdriver::init());
  let app = builder
    .plugin(tauri_plugin_shell::init())
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_autostart::init(MacosLauncher::LaunchAgent, None))
    // Closing the window hides it: the supervisor and the gateway keep serving the LAN (REQ-DESK-03, REQ-DESK-06).
    .on_window_event(|window, event| {
      if let WindowEvent::CloseRequested { api, .. } = event {
        api.prevent_close();
        let _ = window.hide();
        log::info!("window hidden to tray");
      }
    })
    .setup(|app| {
      // The wdio plugin installs its own logger; a second one panics.
      if cfg!(debug_assertions) && !cfg!(feature = "wdio") {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      tray::init(app.handle())?;
      sidecar::init(app.handle());
      Ok(())
    })
    .build(tauri::generate_context!())
    .expect("error while building tauri application");

  app.run(|handle, event| match event {
    // Quit paths that still allow cancelling: stop the tree first, then exit.
    RunEvent::ExitRequested { api, .. } => {
      if !sidecar::is_finished(handle) {
        api.prevent_exit();
        sidecar::stop_then_exit(handle);
      }
    }
    // macOS Cmd+Q arrives here without ExitRequested: last chance, blocks until the tree is gone.
    RunEvent::Exit => sidecar::stop_on_exit(handle),
    _ => {}
  });
}
