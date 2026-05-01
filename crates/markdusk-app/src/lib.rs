mod commands;

use tauri::RunEvent;
#[cfg(any(target_os = "macos", target_os = "ios", target_os = "android"))]
use tauri::{Emitter, Manager};

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            commands::open_file,
            commands::save_file,
        ])
        .build(tauri::generate_context!())
        .expect("error building markdusk")
        .run(|_app, event| {
            #[cfg(any(target_os = "macos", target_os = "ios", target_os = "android"))]
            if let RunEvent::Opened { urls } = &event {
                let paths: Vec<String> = urls
                    .iter()
                    .filter_map(|u| u.to_file_path().ok())
                    .map(|p| p.to_string_lossy().into_owned())
                    .collect();
                if !paths.is_empty()
                    && let Some(window) = _app.get_webview_window("main")
                {
                    let _ = window.emit("markdusk://open-files", &paths);
                }
            }
            // Silence unused-variable warning on platforms where Opened isn't emitted.
            let _ = &event;
        });
}
