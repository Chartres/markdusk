mod commands;
mod menu;

use std::sync::Mutex;
use tauri::Manager;
#[cfg(any(target_os = "macos", target_os = "ios", target_os = "android"))]
use tauri::{Emitter, RunEvent};

#[derive(Default)]
pub struct PendingOpens(pub Mutex<Vec<String>>);

#[tauri::command]
fn drain_pending_opens(state: tauri::State<'_, PendingOpens>) -> Vec<String> {
    state.0.lock().map(|mut v| std::mem::take(&mut *v)).unwrap_or_default()
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(PendingOpens::default())
        .invoke_handler(tauri::generate_handler![
            commands::open_file,
            commands::save_file,
            commands::list_workspace_cmd,
            commands::outline_cmd,
            commands::save_pasted_image,
            commands::export_html,
            commands::render_html_for_clipboard,
            drain_pending_opens,
        ])
        .setup(|app| {
            menu::install(app.handle())?;
            // Capture file paths from launch args (Finder double-click cold-start).
            let pending = app.state::<PendingOpens>();
            for arg in std::env::args().skip(1) {
                if !arg.starts_with('-') && std::path::Path::new(&arg).exists() {
                    if let Ok(mut v) = pending.0.lock() {
                        v.push(arg);
                    }
                }
            }
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error building markdusk")
        .run(|_app, _event| {
            #[cfg(any(target_os = "macos", target_os = "ios", target_os = "android"))]
            if let RunEvent::Opened { urls } = &_event {
                let paths: Vec<String> = urls
                    .iter()
                    .filter_map(|u| u.to_file_path().ok())
                    .map(|p| p.to_string_lossy().into_owned())
                    .collect();
                if paths.is_empty() {
                    return;
                }
                // Always buffer — drain_pending_opens is the read path. Also
                // try to emit so warm-path opens land instantly.
                if let Some(pending) = _app.try_state::<PendingOpens>()
                    && let Ok(mut v) = pending.0.lock()
                {
                    v.extend(paths.iter().cloned());
                }
                if let Some(window) = _app.get_webview_window("main") {
                    let _ = window.emit("markdusk://open-files", &paths);
                }
            }
        });
}
