use tauri::{
    AppHandle, Emitter, Manager, Runtime,
    menu::{Menu, MenuBuilder, MenuItemBuilder, PredefinedMenuItem, SubmenuBuilder},
};

pub fn build<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<Menu<R>> {
    let app_submenu = SubmenuBuilder::new(app, "Markdusk")
        .about(None)
        .separator()
        .item(&PredefinedMenuItem::services(app, None)?)
        .separator()
        .item(&PredefinedMenuItem::hide(app, None)?)
        .item(&PredefinedMenuItem::hide_others(app, None)?)
        .item(&PredefinedMenuItem::show_all(app, None)?)
        .separator()
        .quit()
        .build()?;

    let new_doc = MenuItemBuilder::with_id("file:new", "New")
        .accelerator("CmdOrCtrl+N")
        .build(app)?;
    let open_doc = MenuItemBuilder::with_id("file:open", "Open…")
        .accelerator("CmdOrCtrl+O")
        .build(app)?;
    let open_folder = MenuItemBuilder::with_id("file:open-folder", "Open Folder…")
        .accelerator("CmdOrCtrl+Shift+O")
        .build(app)?;
    let save_doc = MenuItemBuilder::with_id("file:save", "Save")
        .accelerator("CmdOrCtrl+S")
        .build(app)?;

    let file_submenu = SubmenuBuilder::new(app, "File")
        .item(&new_doc)
        .item(&open_doc)
        .item(&open_folder)
        .separator()
        .item(&save_doc)
        .separator()
        .item(&PredefinedMenuItem::close_window(app, None)?)
        .build()?;

    let find_item = MenuItemBuilder::with_id("edit:find", "Find…")
        .accelerator("CmdOrCtrl+F")
        .build(app)?;
    let replace_item = MenuItemBuilder::with_id("edit:replace", "Find & Replace…")
        .accelerator("CmdOrCtrl+Alt+F")
        .build(app)?;

    let edit_submenu = SubmenuBuilder::new(app, "Edit")
        .undo()
        .redo()
        .separator()
        .cut()
        .copy()
        .paste()
        .select_all()
        .separator()
        .item(&find_item)
        .item(&replace_item)
        .build()?;

    let theme_smoke = MenuItemBuilder::with_id("theme:smoke", "Smoke").build(app)?;
    let theme_amber = MenuItemBuilder::with_id("theme:amber", "Amber").build(app)?;
    let theme_submenu = SubmenuBuilder::new(app, "Theme")
        .item(&theme_smoke)
        .item(&theme_amber)
        .build()?;

    let app_system = MenuItemBuilder::with_id("appearance:system", "System").build(app)?;
    let app_light = MenuItemBuilder::with_id("appearance:light", "Light").build(app)?;
    let app_dark = MenuItemBuilder::with_id("appearance:dark", "Dark").build(app)?;
    let appearance_submenu = SubmenuBuilder::new(app, "Appearance")
        .item(&app_system)
        .item(&app_light)
        .item(&app_dark)
        .build()?;

    let mode_default = MenuItemBuilder::with_id("mode:default", "Default").build(app)?;
    let mode_vim = MenuItemBuilder::with_id("mode:vim", "Vim").build(app)?;
    let mode_submenu = SubmenuBuilder::new(app, "Editor Mode")
        .item(&mode_default)
        .item(&mode_vim)
        .build()?;

    let view_submenu = SubmenuBuilder::new(app, "View")
        .item(
            &MenuItemBuilder::with_id("view:toggle-left", "Toggle Files Sidebar")
                .accelerator("CmdOrCtrl+\\")
                .build(app)?,
        )
        .item(
            &MenuItemBuilder::with_id("view:toggle-right", "Toggle Outline")
                .accelerator("CmdOrCtrl+Shift+\\")
                .build(app)?,
        )
        .item(
            &MenuItemBuilder::with_id("view:focus", "Focus Mode")
                .accelerator("CmdOrCtrl+Shift+F")
                .build(app)?,
        )
        .separator()
        .item(&theme_submenu)
        .item(&appearance_submenu)
        .item(&mode_submenu)
        .build()?;

    let window_submenu = SubmenuBuilder::new(app, "Window")
        .minimize()
        .maximize()
        .build()?;

    MenuBuilder::new(app)
        .items(&[
            &app_submenu,
            &file_submenu,
            &edit_submenu,
            &view_submenu,
            &window_submenu,
        ])
        .build()
}

pub fn install<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
    let menu = build(app)?;
    app.set_menu(menu)?;
    let app_clone = app.clone();
    app.on_menu_event(move |_app, event| {
        let id = event.id().as_ref();
        if let Some(window) = app_clone.get_webview_window("main") {
            let _ = window.emit("markdusk://menu", id);
        }
    });
    Ok(())
}
