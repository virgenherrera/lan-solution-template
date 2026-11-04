mod platform;
mod sidecar;

use tauri::RunEvent;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  let app = tauri::Builder::default()
    .plugin(tauri_plugin_shell::init())
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      sidecar::start(app.handle())?;
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
