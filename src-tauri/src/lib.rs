#[cfg(desktop)]
fn setup_tray(app: &tauri::App) -> tauri::Result<()> {
  use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
  use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
  use tauri::{Emitter, Manager};

  let show = MenuItem::with_id(app, "tray.show", "显示窗口", true, None::<&str>)?;
  let toggle_obs = MenuItem::with_id(app, "tray.toggle_obs", "切换 OBS 模式", true, None::<&str>)?;
  let open_settings = MenuItem::with_id(app, "tray.settings", "打开设置", true, None::<&str>)?;
  let quit = MenuItem::with_id(app, "tray.quit", "退出 LiveDanmu", true, None::<&str>)?;
  let separator = PredefinedMenuItem::separator(app)?;
  let menu = Menu::with_items(app, &[&show, &toggle_obs, &open_settings, &separator, &quit])?;

  let _ = TrayIconBuilder::with_id("main")
    .icon(
      app.default_window_icon()
        .expect("default icon should be available")
        .clone(),
    )
    .tooltip("LiveDanmu")
    .menu(&menu)
    .show_menu_on_left_click(false)
    .on_menu_event(|app, event| {
      match event.id().as_ref() {
        "tray.show" => {
          if let Some(window) = app.get_webview_window("main") {
            let _ = window.show();
            let _ = window.unminimize();
            let _ = window.set_focus();
          }
          let _ = app.emit("tray://show-window", ());
        }
        "tray.toggle_obs" => {
          let _ = app.emit("tray://toggle-obs", ());
        }
        "tray.settings" => {
          if let Some(window) = app.get_webview_window("main") {
            let _ = window.show();
            let _ = window.unminimize();
            let _ = window.set_focus();
          }
          let _ = app.emit("tray://open-settings", ());
        }
        "tray.quit" => app.exit(0),
        _ => {}
      }
    })
    .on_tray_icon_event(|tray, event| {
      if let TrayIconEvent::Click {
        button: MouseButton::Left,
        button_state: MouseButtonState::Up,
        ..
      } = event
      {
        let app = tray.app_handle();
        if let Some(window) = app.get_webview_window("main") {
          let _ = window.show();
          let _ = window.unminimize();
          let _ = window.set_focus();
        }
        let _ = app.emit("tray://show-window", ());
      }
    })
    .build(app)?;

  Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .setup(|app| {
      #[cfg(desktop)]
      setup_tray(app)?;

      Ok(())
    })
    .plugin(
      tauri_plugin_log::Builder::default()
        .level(log::LevelFilter::Info)
        .build(),
    )
    .plugin(tauri_plugin_store::Builder::default().build())
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
