mod local_server;
mod secret;
mod ssh;
mod system;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default();

    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            use tauri::Manager;
            if let Some(window) = app.webview_windows().values().next() {
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
        }));
    }

    #[cfg(mobile)]
    {
        builder = builder.plugin(tauri_plugin_barcode_scanner::init());
    }

    builder
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .manage(ssh::SshState::default())
        .manage(local_server::LocalServerState::default())
        .invoke_handler(tauri::generate_handler![
            ssh::ssh_connect,
            ssh::ssh_send,
            ssh::ssh_resize,
            ssh::ssh_close,
            local_server::local_server_status,
            local_server::local_server_start,
            local_server::local_server_stop,
            system::system_accent,
            system::install_update,
            secret::secret_protect,
            secret::secret_unprotect,
            secret::secret_available
        ])
        .run(tauri::generate_context!())
        .expect("error while running CConnect");
}
