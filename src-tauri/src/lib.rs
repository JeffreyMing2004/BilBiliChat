use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindow, WebviewWindowBuilder};

fn focus_window(window: &WebviewWindow) {
  let _ = window.show();
  let _ = window.unminimize();
  let _ = window.set_focus();
}

fn ensure_app_window(app: &AppHandle, kind: &str) -> tauri::Result<()> {
  let (label, title) = match kind {
    "danmu" => ("danmu", "LiveDanmu - DanmuWindow"),
    "settings" => ("settings", "LiveDanmu - SettingsWindow"),
    "login" => ("login", "LiveDanmu - LoginWindow"),
    _ => ("main", "LiveDanmu"),
  };

  if let Some(window) = app.get_webview_window(label) {
    focus_window(&window);
    return Ok(());
  }

  let builder = WebviewWindowBuilder::new(app, label, WebviewUrl::App("index.html".into()))
    .title(title)
    .visible(true);

  let builder = match kind {
    "danmu" => builder
      .inner_size(1080.0, 760.0)
      .min_inner_size(720.0, 480.0)
      .transparent(true)
      .decorations(false)
      .always_on_top(true)
      .resizable(true)
      .skip_taskbar(true),
    "settings" => builder
      .inner_size(980.0, 860.0)
      .min_inner_size(840.0, 720.0)
      .transparent(true)
      .decorations(false)
      .resizable(true),
    "login" => builder
      .inner_size(720.0, 460.0)
      .min_inner_size(640.0, 420.0)
      .transparent(true)
      .decorations(false)
      .resizable(false),
    _ => builder,
  };

  let window = builder.build()?;
  focus_window(&window);
  Ok(())
}

#[tauri::command]
fn open_app_window(app: AppHandle, kind: String) -> Result<(), String> {
  if kind == "main" {
    if let Some(window) = app.get_webview_window("main") {
      focus_window(&window);
      return Ok(());
    }
  }

  ensure_app_window(&app, &kind).map_err(|error| error.to_string())
}

#[tauri::command]
fn broadcast_window_event(app: AppHandle, event: String, payload: serde_json::Value) -> Result<(), String> {
  app.emit(event.as_str(), payload).map_err(|error| error.to_string())
}

#[cfg(desktop)]
fn setup_tray(app: &tauri::App) -> tauri::Result<()> {
  use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
  use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};

  let show = MenuItem::with_id(app, "tray.show", "显示主控制台", true, None::<&str>)?;
  let toggle_obs = MenuItem::with_id(app, "tray.toggle_obs", "切换 OBS 模式", true, None::<&str>)?;
  let open_settings = MenuItem::with_id(app, "tray.settings", "打开设置窗口", true, None::<&str>)?;
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
    .on_menu_event(|app, event| match event.id().as_ref() {
      "tray.show" => {
        if let Some(window) = app.get_webview_window("main") {
          focus_window(&window);
        }
        let _ = app.emit("tray://show-window", ());
      }
      "tray.toggle_obs" => {
        let _ = app.emit("tray://toggle-obs", ());
      }
      "tray.settings" => {
        let _ = ensure_app_window(app, "settings");
        let _ = app.emit("tray://open-settings", ());
      }
      "tray.quit" => app.exit(0),
      _ => {}
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
          focus_window(&window);
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
    .invoke_handler(tauri::generate_handler![open_app_window, broadcast_window_event])
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
