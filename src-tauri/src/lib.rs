mod commands;

use tauri::Emitter;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_opener::init())
    .plugin(tauri_plugin_updater::Builder::new().build())
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }

      let update_handle = app.handle().clone();
      tauri::async_runtime::spawn(async move {
        tokio::time::sleep(std::time::Duration::from_millis(3000)).await;
        match commands::updater::check_for_update(update_handle.clone()).await {
          Ok(Some(info)) => {
            log::info!("Update available: {}", info.version);
            let _ = update_handle.emit("updater-update-available", &info);
          }
          Ok(None) => log::info!("App is up to date."),
          Err(e) => log::warn!("Update check failed: {}", e),
        }
      });

      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      commands::updater::check_for_update,
      commands::updater::install_update,
      commands::updater::open_releases_page,
      commands::updater::restart_app,
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
