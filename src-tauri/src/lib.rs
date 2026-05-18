use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindow, WebviewWindowBuilder};
#[cfg(target_os = "macos")]
use tauri::TitleBarStyle;

fn focus_window(window: &WebviewWindow) {
  let _ = window.show();
  let _ = window.unminimize();
  let _ = window.set_focus();
}

#[cfg(target_os = "macos")]
fn apply_macos_native_titlebar<'a, R: tauri::Runtime, M: Manager<R>>(
  builder: WebviewWindowBuilder<'a, R, M>,
) -> WebviewWindowBuilder<'a, R, M> {
  builder
    .decorations(true)
    .shadow(true)
    .title_bar_style(TitleBarStyle::Visible)
}

#[cfg(not(target_os = "macos"))]
fn apply_macos_native_titlebar<'a, R: tauri::Runtime, M: Manager<R>>(
  builder: WebviewWindowBuilder<'a, R, M>,
) -> WebviewWindowBuilder<'a, R, M> {
  builder
}

#[cfg(target_os = "macos")]
fn apply_macos_native_chrome<'a, R: tauri::Runtime, M: Manager<R>>(
  builder: WebviewWindowBuilder<'a, R, M>,
) -> WebviewWindowBuilder<'a, R, M> {
  apply_macos_native_titlebar(builder).transparent(false)
}

#[cfg(not(target_os = "macos"))]
fn apply_macos_native_chrome<'a, R: tauri::Runtime, M: Manager<R>>(
  builder: WebviewWindowBuilder<'a, R, M>,
) -> WebviewWindowBuilder<'a, R, M> {
  builder
}

fn ensure_app_window(app: &AppHandle, kind: &str) -> tauri::Result<()> {
  let (label, title) = match kind {
    "danmu" => ("danmu", "BilBiliChat - DanmuWindow"),
    "settings" => ("settings", "BilBiliChat - SettingsWindow"),
    "login" => ("login", "BilBiliChat - LoginWindow"),
    "debug" => ("debug", "BilBiliChat - DebugWindow"),
    "crash" => ("crash", "BilBiliChat - CrashWindow"),
    "overlay-studio" => ("overlay-studio", "BilBiliChat - OverlayStudioWindow"),
    _ => ("main", "BilBiliChat"),
  };

  if let Some(window) = app.get_webview_window(label) {
    focus_window(&window);
    return Ok(());
  }

  let builder = WebviewWindowBuilder::new(app, label, WebviewUrl::App("index.html".into()))
    .title(title)
    .visible(true);

  #[cfg(target_os = "macos")]
  let builder = if cfg!(debug_assertions) {
    builder.incognito(true)
  } else {
    builder
  };

  let builder = match kind {
    "danmu" => {
      let builder = builder
        .inner_size(1080.0, 760.0)
        .min_inner_size(720.0, 480.0)
        .transparent(true)
        .decorations(false)
        .resizable(true);

      #[cfg(target_os = "macos")]
      let builder = apply_macos_native_titlebar(builder)
        .always_on_top(false)
        .skip_taskbar(false);

      #[cfg(not(target_os = "macos"))]
      let builder = builder
        .always_on_top(true)
        .skip_taskbar(true);

      builder
    }
    "settings" => apply_macos_native_chrome(
      builder
        .inner_size(980.0, 860.0)
        .min_inner_size(840.0, 720.0)
        .transparent(true)
        .decorations(false)
        .resizable(true),
    ),
    "login" => apply_macos_native_chrome(
      builder
        .inner_size(720.0, 460.0)
        .min_inner_size(640.0, 420.0)
        .transparent(true)
        .decorations(false)
        .resizable(false),
    ),
    "debug" => apply_macos_native_chrome(
      builder
        .inner_size(760.0, 540.0)
        .min_inner_size(680.0, 480.0)
        .transparent(true)
        .decorations(false)
        .resizable(true),
    ),
    "crash" => apply_macos_native_chrome(
      builder
        .inner_size(1120.0, 760.0)
        .min_inner_size(920.0, 620.0)
        .transparent(true)
        .decorations(false)
        .resizable(true),
    ),
    "overlay-studio" => apply_macos_native_chrome(
      builder
        .inner_size(1440.0, 900.0)
        .min_inner_size(1180.0, 760.0)
        .transparent(true)
        .decorations(false)
        .resizable(true),
    ),
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

#[tauri::command]
fn close_app_window(app: AppHandle, label: String) -> Result<(), String> {
  if label == "main" {
    if let Some(window) = app.get_webview_window("main") {
      window.hide().map_err(|error| error.to_string())?;
      return Ok(());
    }
    return Err("主窗口不存在".into());
  }

  let window = app
    .get_webview_window(&label)
    .ok_or_else(|| format!("窗口不存在: {label}"))?;

  window.close().map_err(|error| error.to_string())
}

#[cfg(debug_assertions)]
fn setup_window_lifecycle_selftest(app: &tauri::App) {
  if std::env::var("BILBILICHAT_SELFTEST_WINDOWS").ok().as_deref() != Some("1") {
    return;
  }

  let app_handle = app.handle().clone();
  std::thread::spawn(move || {
    use std::time::Duration;

    for kind in ["debug", "login", "settings", "danmu", "overlay-studio", "crash"] {
      std::thread::sleep(Duration::from_millis(900));

      if let Err(error) = ensure_app_window(&app_handle, kind) {
        log::error!("window selftest open {kind} failed: {error}");
        continue;
      }
      log::info!("window selftest opened {kind}");

      std::thread::sleep(Duration::from_millis(800));

      if let Err(error) = close_app_window(app_handle.clone(), kind.to_string()) {
        log::error!("window selftest close {kind} failed: {error}");
      } else {
        log::info!("window selftest closed {kind}");
      }
    }
  });
}

#[cfg(desktop)]
fn setup_tray(app: &tauri::App) -> tauri::Result<()> {
  use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
  use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};

  let show = MenuItem::with_id(app, "tray.show", "显示主控制台", true, None::<&str>)?;
  let toggle_obs = MenuItem::with_id(app, "tray.toggle_obs", "切换 OBS 模式", true, None::<&str>)?;
  let open_settings = MenuItem::with_id(app, "tray.settings", "打开设置窗口", true, None::<&str>)?;
  let quit = MenuItem::with_id(app, "tray.quit", "退出 BilBiliChat", true, None::<&str>)?;
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
  let mut builder = tauri::Builder::default();

  #[cfg(desktop)]
  {
    builder = builder
      .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
        log::info!("second instance received argv: {argv:?}");

        if let Some(window) = app.get_webview_window("main") {
          focus_window(&window);
        } else {
          let _ = ensure_app_window(app, "main");
        }
      }))
      .plugin(tauri_plugin_deep_link::init())
      .plugin(tauri_plugin_shell::init())
      .plugin(tauri_plugin_process::init())
      .plugin(tauri_plugin_updater::Builder::new().build());
  }

  builder
    .invoke_handler(tauri::generate_handler![
      open_app_window,
      close_app_window,
      broadcast_window_event
    ])
    .setup(|app| {
      #[cfg(desktop)]
      {
        setup_tray(app)?;
        #[cfg(debug_assertions)]
        setup_window_lifecycle_selftest(app);
      }

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
