mod commands;
mod menu;

use tauri::Manager;
#[cfg(any(target_os = "macos", target_os = "ios", target_os = "android"))]
use tauri::{Emitter, RunEvent};

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            commands::open_file,
            commands::save_file,
            commands::list_workspace_cmd,
            commands::outline_cmd,
            commands::save_pasted_image,
        ])
        .setup(|app| {
            menu::install(app.handle())?;
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error building markdusk")
        .run(|_app, _event| {
            #[cfg(any(target_os = "macos", target_os = "ios", target_os = "android"))]
            if let RunEvent::Opened { urls } = &_event
                && let Some(window) = _app.get_webview_window("main")
            {
                let paths: Vec<String> = urls
                    .iter()
                    .filter_map(|u| u.to_file_path().ok())
                    .map(|p| p.to_string_lossy().into_owned())
                    .collect();
                if !paths.is_empty() {
                    let _ = window.emit("markdusk://open-files", &paths);
                }
            }
        });
}
