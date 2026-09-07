mod local_server;
mod presence;
mod secret;
mod ssh;
mod system;

use tauri::Manager;

const MAIN_WINDOW: &str = "main";
#[cfg(desktop)]
const TRAY_ID: &str = "cconnect";

#[cfg(desktop)]
fn state_flags() -> tauri_plugin_window_state::StateFlags {
    use tauri_plugin_window_state::StateFlags;
    StateFlags::all() & !StateFlags::VISIBLE
}

#[cfg(desktop)]
const SCREEN_WIDTH_FRACTION: f64 = 0.8;
#[cfg(desktop)]
const SCREEN_HEIGHT_FRACTION: f64 = 0.85;

#[cfg(desktop)]
fn present_window(app: &tauri::App) {
    use tauri::{LogicalPosition, LogicalSize};

    let Some(window) = app.get_webview_window(MAIN_WINDOW) else {
        return;
    };

    let stored = app
        .path()
        .app_config_dir()
        .map(|dir| dir.join(tauri_plugin_window_state::DEFAULT_FILENAME));
    let restored = matches!(stored, Ok(path) if path.exists());

    if !restored {
        if let Ok(Some(monitor)) = window.current_monitor() {
            let scale = monitor.scale_factor();
            let area = monitor.work_area();
            let available_width = f64::from(area.size.width) / scale;
            let available_height = f64::from(area.size.height) / scale;
            let width = (available_width * SCREEN_WIDTH_FRACTION).round();
            let height = (available_height * SCREEN_HEIGHT_FRACTION).round();

            let _ = window.set_size(LogicalSize::new(width, height));
            let _ = window.set_position(LogicalPosition::new(
                (f64::from(area.position.x) / scale + (available_width - width) / 2.0).round(),
                (f64::from(area.position.y) / scale + (available_height - height) / 2.0).round(),
            ));
        }
    }

    let _ = window.show();
}

#[cfg(windows)]
fn hide_helper_windows() {
    use windows_sys::Win32::Foundation::{HWND, LPARAM};
    use windows_sys::Win32::System::Threading::GetCurrentProcessId;
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        EnumWindows, GetClassNameW, GetWindowThreadProcessId, ShowWindow, SW_HIDE,
    };

    const TAO_EVENT_TARGET: &str = "Tao Thread Event Target";
    const SINGLE_INSTANCE_SUFFIX: &str = "-sic";

    unsafe extern "system" fn visit(window: HWND, _: LPARAM) -> i32 {
        let mut owner = 0u32;
        unsafe { GetWindowThreadProcessId(window, &mut owner) };
        if owner != unsafe { GetCurrentProcessId() } {
            return 1;
        }

        let mut name = [0u16; 64];
        let length = unsafe { GetClassNameW(window, name.as_mut_ptr(), name.len() as i32) };
        let class = String::from_utf16_lossy(&name[..length.max(0) as usize]);
        if class == TAO_EVENT_TARGET || class.ends_with(SINGLE_INSTANCE_SUFFIX) {
            unsafe { ShowWindow(window, SW_HIDE) };
        }
        1
    }

    unsafe { EnumWindows(Some(visit), 0) };
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default();

    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            use tauri::Manager;
            if let Some(window) = app.webview_windows().values().next() {
                let _ = window.show();
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
        }));
        builder = builder.plugin(
            tauri_plugin_window_state::Builder::default()
                .with_state_flags(state_flags())
                .build(),
        );
    }

    #[cfg(mobile)]
    {
        builder = builder.plugin(tauri_plugin_barcode_scanner::init());
    }

    builder
        .setup(|_app| {
            #[cfg(windows)]
            hide_helper_windows();
            #[cfg(desktop)]
            present_window(_app);
            Ok(())
        })
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .manage(ssh::SshState::default())
        .manage(local_server::LocalServerState::default())
        .manage(presence::Presence::default())
        .invoke_handler(tauri::generate_handler![
            ssh::ssh_connect,
            ssh::ssh_send,
            ssh::ssh_resize,
            ssh::ssh_close,
            local_server::local_server_status,
            local_server::local_server_start,
            local_server::local_server_stop,
            local_server::local_server_restart,
            system::system_accent,
            system::install_update,
            secret::secret_protect,
            secret::secret_unprotect,
            secret::secret_available,
            presence::presence_set,
            presence::presence_clear
        ])
        .build(tauri::generate_context!())
        .expect("error while running CConnect")
        .run(|app, event| match event {
            #[cfg(desktop)]
            tauri::RunEvent::WindowEvent {
                label,
                event: tauri::WindowEvent::CloseRequested { .. },
                ..
            } if label == MAIN_WINDOW => {
                use tauri_plugin_window_state::AppHandleExt;
                let _ = app.save_window_state(state_flags());
            }
            tauri::RunEvent::WindowEvent {
                label,
                event: tauri::WindowEvent::Destroyed,
                ..
            } if label == MAIN_WINDOW => {
                #[cfg(desktop)]
                let _ = app.remove_tray_by_id(TRAY_ID);
                #[cfg(desktop)]
                presence::shutdown(&app.state::<presence::Presence>());
                local_server::shutdown(&app.state::<local_server::LocalServerState>());
                std::process::exit(0);
            }
            tauri::RunEvent::Exit => {
                #[cfg(desktop)]
                presence::shutdown(&app.state::<presence::Presence>());
                local_server::shutdown(&app.state::<local_server::LocalServerState>());
            }
            _ => {}
        });
}
