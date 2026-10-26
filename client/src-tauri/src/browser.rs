use std::collections::HashSet;
use std::sync::Mutex;

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, Runtime, State, Url, Webview};

const LABEL_PREFIX: &str = "browser-";
const PROFILE_DIR: &str = "Browser";
#[cfg(target_os = "macos")]
pub(crate) const PROFILE_STORE: [u8; 16] = *b"cconnect-browser";
#[cfg(windows)]
const PROFILE_DATA: &str = "EBWebView/Default";
#[cfg(windows)]
const WEBVIEW_ARGUMENTS: &str = "--disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection";
const STATE_EVENT: &str = "browser-state";
const OPEN_EVENT: &str = "browser-open";
const PICKED_EVENT: &str = "browser-picked";
const PICKING_EVENT: &str = "browser-picking";
const FOCUSED_EVENT: &str = "browser-focused";
const ZOOM_EVENT: &str = "browser-zoom";
#[cfg(windows)]
const KEY_EVENT: &str = "browser-key";
#[cfg(windows)]
const SHIELD_EVENT: &str = "browser-shield";
const SIGNAL_MARK: &str = "\u{2063}cconnect:";
#[cfg(not(windows))]
const HISTORY_PROBE: &str = "[location.href, window.navigation ? window.navigation.canGoBack : null, window.navigation ? window.navigation.canGoForward : null]";
#[derive(Default)]
pub struct BrowserKeys(Mutex<HashSet<String>>);

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct PageState {
    id: String,
    url: Option<String>,
    title: Option<String>,
    favicon: Option<String>,
    loading: Option<bool>,
    can_go_back: Option<bool>,
    can_go_forward: Option<bool>,
}

#[derive(Clone, Serialize)]
struct OpenRequest {
    id: String,
    url: String,
}

impl PageState {
    fn of(id: &str) -> Self {
        Self {
            id: id.to_string(),
            url: None,
            title: None,
            favicon: None,
            loading: None,
            can_go_back: None,
            can_go_forward: None,
        }
    }
}

fn label(id: &str) -> Result<String, String> {
    if id.is_empty() || !id.chars().all(|c| c.is_ascii_alphanumeric() || c == '-') {
        return Err(format!("invalid browser tab id: {id}"));
    }
    Ok(format!("{LABEL_PREFIX}{id}"))
}

fn tab_of(label: &str) -> String {
    label.trim_start_matches(LABEL_PREFIX).to_string()
}

fn page<R: Runtime>(app: &AppHandle<R>, id: &str) -> Result<Webview<R>, String> {
    app.get_webview(&label(id)?)
        .ok_or_else(|| format!("no browser tab {id}"))
}

fn parse(url: &str) -> Result<Url, String> {
    url.parse::<Url>().map_err(|error| error.to_string())
}

fn report<R: Runtime>(webview: &Webview<R>, state: PageState) {
    let _ = webview.app_handle().emit_to(crate::MAIN_WINDOW, STATE_EVENT, state);
}

#[cfg(windows)]
fn history_of(
    id: &str,
    core: &webview2_com::Microsoft::Web::WebView2::Win32::ICoreWebView2,
) -> PageState {
    use windows_core::{BOOL, PWSTR};

    let mut state = PageState::of(id);
    let mut back = BOOL::default();
    let mut forward = BOOL::default();
    let mut source = PWSTR::null();
    unsafe {
        if core.CanGoBack(&mut back).is_ok() {
            state.can_go_back = Some(back.as_bool());
        }
        if core.CanGoForward(&mut forward).is_ok() {
            state.can_go_forward = Some(forward.as_bool());
        }
        if core.Source(&mut source).is_ok() {
            state.url = Some(webview2_com::take_pwstr(source));
        }
    }
    state
}

#[cfg(windows)]
fn code_of(key: u32) -> Option<String> {
    let named = match key {
        0x08 => "Backspace",
        0x09 => "Tab",
        0x0D => "Enter",
        0x1B => "Escape",
        0x20 => "Space",
        0x21 => "PageUp",
        0x22 => "PageDown",
        0x23 => "End",
        0x24 => "Home",
        0x25 => "ArrowLeft",
        0x26 => "ArrowUp",
        0x27 => "ArrowRight",
        0x28 => "ArrowDown",
        0x2E => "Delete",
        0xBA => "Semicolon",
        0xBB | 0x6B => "Equal",
        0xBC => "Comma",
        0xBD | 0x6D => "Minus",
        0xBE => "Period",
        0xBF => "Slash",
        0xC0 => "Backquote",
        0xDB => "BracketLeft",
        0xDC => "Backslash",
        0xDD => "BracketRight",
        0xDE => "Quote",
        _ => "",
    };
    if !named.is_empty() {
        return Some(named.to_string());
    }
    match key {
        0x30..=0x39 => Some(format!("Digit{}", key - 0x30)),
        0x41..=0x5A => Some(format!("Key{}", char::from(key as u8))),
        0x60..=0x69 => Some(format!("Digit{}", key - 0x60)),
        0x70..=0x87 => Some(format!("F{}", key - 0x6F)),
        _ => None,
    }
}

#[cfg(windows)]
fn signature_of(key: u32) -> Option<String> {
    use windows_sys::Win32::UI::Input::KeyboardAndMouse::{
        GetKeyState, VK_CONTROL, VK_LWIN, VK_MENU, VK_RWIN, VK_SHIFT,
    };

    let code = code_of(key)?;
    let held = |virtual_key: u16| unsafe { GetKeyState(i32::from(virtual_key)) } < 0;
    let modifiers = [
        (held(VK_CONTROL), "Ctrl"),
        (held(VK_MENU), "Alt"),
        (held(VK_SHIFT), "Shift"),
        (held(VK_LWIN) || held(VK_RWIN), "Meta"),
    ];
    let mut parts: Vec<String> = modifiers
        .iter()
        .filter(|(down, _)| *down)
        .map(|(_, name)| name.to_string())
        .collect();
    parts.push(code);
    Some(parts.join("+"))
}

fn signal<R: Runtime>(webview: &Webview<R>, id: &str, json: &str) {
    let Ok(message) = serde_json::from_str::<serde_json::Value>(json) else {
        return;
    };
    let data = message.get("data").cloned().unwrap_or_default();
    let app = webview.app_handle();
    match message.get("kind").and_then(|kind| kind.as_str()) {
        Some("picked") => {
            let mut payload = data;
            if let Some(fields) = payload.as_object_mut() {
                fields.insert("id".to_string(), id.into());
                let _ = app.emit_to(crate::MAIN_WINDOW, PICKED_EVENT, payload);
            }
        }
        Some("picking") => {
            let _ = app.emit_to(
                crate::MAIN_WINDOW,
                PICKING_EVENT,
                serde_json::json!({ "id": id, "picking": data.as_bool().unwrap_or(false) }),
            );
        }
        Some("focused") => {
            let _ = app.emit_to(crate::MAIN_WINDOW, FOCUSED_EVENT, serde_json::json!({ "id": id }));
        }
        Some("zoom") => {
            let _ = app.emit_to(
                crate::MAIN_WINDOW,
                ZOOM_EVENT,
                serde_json::json!({ "id": id, "step": data.as_i64().unwrap_or(0) }),
            );
        }
        Some("favicon") => {
            let mut state = PageState::of(id);
            state.favicon = data.as_str().map(str::to_string);
            report(webview, state);
        }
        _ => {}
    }
}

#[cfg(windows)]
fn watch_native<R: Runtime>(webview: &Webview<R>) {
    use webview2_com::Microsoft::Web::WebView2::Win32::{
        COREWEBVIEW2_KEY_EVENT_KIND, COREWEBVIEW2_KEY_EVENT_KIND_KEY_DOWN,
        COREWEBVIEW2_KEY_EVENT_KIND_SYSTEM_KEY_DOWN,
    };
    use webview2_com::{AcceleratorKeyPressedEventHandler, HistoryChangedEventHandler};

    let id = tab_of(webview.label());
    let target = webview.clone();
    let _ = webview.with_webview(move |platform| {
        let controller = platform.controller();
        let Ok(core) = (unsafe { controller.CoreWebView2() }) else {
            return;
        };
        let (history_id, history_target) = (id.clone(), target.clone());
        let history = HistoryChangedEventHandler::create(Box::new(move |sender, _| {
            if let Some(core) = sender {
                report(&history_target, history_of(&history_id, &core));
            }
            Ok(())
        }));
        let (key_id, key_target) = (id.clone(), target.clone());
        let keys = AcceleratorKeyPressedEventHandler::create(Box::new(move |_, args| {
            let Some(args) = args else {
                return Ok(());
            };
            let mut kind = COREWEBVIEW2_KEY_EVENT_KIND::default();
            let mut key = 0u32;
            unsafe {
                args.KeyEventKind(&mut kind)?;
                args.VirtualKey(&mut key)?;
            }
            if kind != COREWEBVIEW2_KEY_EVENT_KIND_KEY_DOWN
                && kind != COREWEBVIEW2_KEY_EVENT_KIND_SYSTEM_KEY_DOWN
            {
                return Ok(());
            }
            let Some(signature) = signature_of(key) else {
                return Ok(());
            };
            let app = key_target.app_handle();
            let wanted = app
                .state::<BrowserKeys>()
                .0
                .lock()
                .map(|keys| keys.contains(&signature))
                .unwrap_or(false);
            if wanted {
                unsafe { args.SetHandled(true)? };
                let _ = app.emit_to(
                    crate::MAIN_WINDOW,
                    KEY_EVENT,
                    serde_json::json!({ "id": key_id, "keys": signature }),
                );
            }
            Ok(())
        }));
        let mut token = 0i64;
        unsafe {
            let _ = core.add_HistoryChanged(&history, &mut token);
            let _ = controller.add_AcceleratorKeyPressed(&keys, &mut token);
        }
        guard(&target, &core);
    });
}

#[cfg(windows)]
fn kind_of(context: webview2_com::Microsoft::Web::WebView2::Win32::COREWEBVIEW2_WEB_RESOURCE_CONTEXT) -> &'static str {
    use webview2_com::Microsoft::Web::WebView2::Win32::*;

    match context {
        COREWEBVIEW2_WEB_RESOURCE_CONTEXT_DOCUMENT => "subdocument",
        COREWEBVIEW2_WEB_RESOURCE_CONTEXT_STYLESHEET => "stylesheet",
        COREWEBVIEW2_WEB_RESOURCE_CONTEXT_IMAGE => "image",
        COREWEBVIEW2_WEB_RESOURCE_CONTEXT_MEDIA => "media",
        COREWEBVIEW2_WEB_RESOURCE_CONTEXT_FONT => "font",
        COREWEBVIEW2_WEB_RESOURCE_CONTEXT_SCRIPT => "script",
        COREWEBVIEW2_WEB_RESOURCE_CONTEXT_XML_HTTP_REQUEST | COREWEBVIEW2_WEB_RESOURCE_CONTEXT_FETCH => "xmlhttprequest",
        COREWEBVIEW2_WEB_RESOURCE_CONTEXT_WEBSOCKET => "websocket",
        COREWEBVIEW2_WEB_RESOURCE_CONTEXT_PING => "ping",
        _ => "other",
    }
}

#[cfg(windows)]
fn source_of(core: &webview2_com::Microsoft::Web::WebView2::Win32::ICoreWebView2) -> String {
    let mut source = windows_core::PWSTR::null();
    match unsafe { core.Source(&mut source) } {
        Ok(()) => webview2_com::take_pwstr(source),
        Err(_) => String::new(),
    }
}

#[cfg(windows)]
fn guard<R: Runtime>(target: &Webview<R>, core: &webview2_com::Microsoft::Web::WebView2::Win32::ICoreWebView2) {
    use std::sync::atomic::{AtomicU32, Ordering};
    use std::sync::Arc;
    use webview2_com::Microsoft::Web::WebView2::Win32::{
        ICoreWebView2_2, COREWEBVIEW2_WEB_RESOURCE_CONTEXT, COREWEBVIEW2_WEB_RESOURCE_CONTEXT_DOCUMENT,
    };
    use webview2_com::{DOMContentLoadedEventHandler, NavigationStartingEventHandler, WebResourceRequestedEventHandler};
    use windows_core::{w, Interface, PWSTR};

    let id = tab_of(target.label());
    let blocked = Arc::new(AtomicU32::new(0));
    let navigating = Arc::new(std::sync::Mutex::new(String::new()));
    let Some(environment) = core
        .cast::<ICoreWebView2_2>()
        .ok()
        .and_then(|core| unsafe { core.Environment() }.ok())
    else {
        return;
    };
    let tell = {
        let (id, target) = (id.clone(), target.clone());
        move |count: u32| {
            let _ = target.app_handle().emit_to(
                crate::MAIN_WINDOW,
                SHIELD_EVENT,
                serde_json::json!({ "id": id, "blocked": count }),
            );
        }
    };
    let (request_count, request_navigation, request_target, request_tell) =
        (blocked.clone(), navigating.clone(), target.clone(), tell.clone());
    let requests = WebResourceRequestedEventHandler::create(Box::new(move |sender, args| {
        let (Some(core), Some(args)) = (sender, args) else {
            return Ok(());
        };
        let mut context = COREWEBVIEW2_WEB_RESOURCE_CONTEXT::default();
        let mut uri = PWSTR::null();
        unsafe {
            args.ResourceContext(&mut context)?;
            args.Request()?.Uri(&mut uri)?;
        }
        let url = webview2_com::take_pwstr(uri);
        let main = context == COREWEBVIEW2_WEB_RESOURCE_CONTEXT_DOCUMENT
            && request_navigation.lock().map(|current| *current == url).unwrap_or(false);
        if main {
            return Ok(());
        }
        let shield = request_target.app_handle().state::<crate::shield::Shield>();
        if !shield.blocks(&url, &source_of(&core), kind_of(context)) {
            return Ok(());
        }
        let response = unsafe {
            environment.CreateWebResourceResponse(
                None::<&windows::Win32::System::Com::IStream>,
                403,
                w!("Blocked"),
                w!(""),
            )
        }?;
        unsafe { args.SetResponse(&response)? };
        request_tell(request_count.fetch_add(1, Ordering::Relaxed) + 1);
        Ok(())
    }));
    let (start_count, start_navigation, start_tell) = (blocked.clone(), navigating.clone(), tell.clone());
    let starts = NavigationStartingEventHandler::create(Box::new(move |_, args| {
        let Some(args) = args else {
            return Ok(());
        };
        let mut uri = PWSTR::null();
        unsafe { args.Uri(&mut uri)? };
        if let Ok(mut current) = start_navigation.lock() {
            *current = webview2_com::take_pwstr(uri);
        }
        start_count.store(0, Ordering::Relaxed);
        start_tell(0);
        Ok(())
    }));
    let loaded_target = target.clone();
    let loaded = DOMContentLoadedEventHandler::create(Box::new(move |sender, _| {
        let Some(core) = sender else {
            return Ok(());
        };
        let shield = loaded_target.app_handle().state::<crate::shield::Shield>();
        if let Some(script) = shield.hiding(&source_of(&core)) {
            let _ = loaded_target.eval(script);
        }
        Ok(())
    }));
    filter(core, target.app_handle().state::<crate::shield::Shield>().active());
    let mut token = 0i64;
    unsafe {
        let _ = core.add_WebResourceRequested(&requests, &mut token);
        let _ = core.add_NavigationStarting(&starts, &mut token);
        if let Ok(core) = core.cast::<ICoreWebView2_2>() {
            let _ = core.add_DOMContentLoaded(&loaded, &mut token);
        }
    }
}

#[cfg(windows)]
fn filter(core: &webview2_com::Microsoft::Web::WebView2::Win32::ICoreWebView2, on: bool) {
    use webview2_com::Microsoft::Web::WebView2::Win32::COREWEBVIEW2_WEB_RESOURCE_CONTEXT_ALL;
    use windows_core::w;

    unsafe {
        let _ = core.RemoveWebResourceRequestedFilter(w!("*"), COREWEBVIEW2_WEB_RESOURCE_CONTEXT_ALL);
        if on {
            let _ = core.AddWebResourceRequestedFilter(w!("*"), COREWEBVIEW2_WEB_RESOURCE_CONTEXT_ALL);
        }
    }
}

#[cfg(windows)]
pub(crate) fn filter_all<R: Runtime>(app: &AppHandle<R>) {
    let on = app.state::<crate::shield::Shield>().active();
    for tab in tabs_of(app) {
        let _ = tab.with_webview(move |platform| {
            if let Ok(core) = unsafe { platform.controller().CoreWebView2() } {
                filter(&core, on);
            }
        });
    }
}

#[cfg(windows)]
fn host_of(platform: &tauri::webview::PlatformWebview) -> Option<windows_sys::Win32::Foundation::HWND> {
    let mut host = Default::default();
    unsafe { platform.controller().ParentWindow(&mut host).ok()? };
    let raw: *mut std::ffi::c_void = host.0;
    (!raw.is_null()).then_some(raw)
}

#[cfg(windows)]
fn sink<R: Runtime>(webview: &Webview<R>) {
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        SetWindowPos, HWND_BOTTOM, SWP_NOACTIVATE, SWP_NOMOVE, SWP_NOSIZE,
    };

    let _ = webview.with_webview(|platform| {
        if let Some(host) = host_of(&platform) {
            unsafe { SetWindowPos(host, HWND_BOTTOM, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE) };
        }
    });
}

#[cfg(windows)]
fn see_through<R: Runtime>(app: &AppHandle<R>) {
    if let Some(main) = app.get_webview(crate::MAIN_WINDOW) {
        let _ = main.set_background_color(Some(tauri::window::Color(0, 0, 0, 0)));
    }
}

#[derive(Clone, Copy, serde::Deserialize)]
#[cfg_attr(not(windows), allow(dead_code))]
pub struct Area {
    x: f64,
    y: f64,
    width: f64,
    height: f64,
}

#[cfg(windows)]
fn carve(host: windows_sys::Win32::Foundation::HWND, scale: f64, hole: Option<Area>, radius: f64, cover: &[Area]) {
    use windows_sys::Win32::Graphics::Gdi::{
        CombineRgn, CreateRectRgn, CreateRoundRectRgn, DeleteObject, SetWindowRgn, RGN_DIFF,
    };

    const EVERYWHERE: i32 = 0x7FFF;
    let Some(hole) = hole else {
        unsafe { SetWindowRgn(host, std::ptr::null_mut(), 1) };
        return;
    };
    let edge = |value: f64| (value * scale).round() as i32;
    let rect = |area: &Area| unsafe {
        CreateRectRgn(edge(area.x), edge(area.y), edge(area.x + area.width), edge(area.y + area.height))
    };
    let corner = edge(radius * 2.0);
    unsafe {
        let shown = CreateRectRgn(-EVERYWHERE, -EVERYWHERE, EVERYWHERE, EVERYWHERE);
        let open = CreateRoundRectRgn(
            edge(hole.x),
            edge(hole.y),
            edge(hole.x + hole.width) + 1,
            edge(hole.y + hole.height) + 1,
            corner,
            corner,
        );
        for area in cover {
            let covered = rect(area);
            CombineRgn(open, open, covered, RGN_DIFF);
            DeleteObject(covered);
        }
        CombineRgn(shown, shown, open, RGN_DIFF);
        DeleteObject(open);
        SetWindowRgn(host, shown, 1);
    }
}


#[cfg(windows)]
fn probe_history<R: Runtime>(webview: &Webview<R>) {
    let id = tab_of(webview.label());
    let target = webview.clone();
    let _ = webview.with_webview(move |platform| {
        if let Ok(core) = unsafe { platform.controller().CoreWebView2() } {
            report(&target, history_of(&id, &core));
        }
    });
}

#[cfg(not(windows))]
fn watch_native<R: Runtime>(_webview: &Webview<R>) {}

#[cfg(not(windows))]
fn probe_history<R: Runtime>(webview: &Webview<R>) {
    let id = tab_of(webview.label());
    let target = webview.clone();
    let _ = webview.eval_with_callback(HISTORY_PROBE, move |result| {
        let Ok((url, back, forward)) = serde_json::from_str::<(String, Option<bool>, Option<bool>)>(&result) else {
            return;
        };
        let mut state = PageState::of(&id);
        state.url = Some(url);
        state.can_go_back = back;
        state.can_go_forward = forward;
        report(&target, state);
    });
}

#[tauri::command]
pub async fn browser_open<R: Runtime>(
    app: AppHandle<R>,
    id: String,
    url: String,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
    proxy: Proxy,
) -> Result<(), String> {
    use tauri::webview::{NewWindowResponse, PageLoadEvent};
    use tauri::{LogicalPosition, LogicalSize, WebviewBuilder, WebviewUrl};

    let name = label(&id)?;
    if let Some(existing) = app.get_webview(&name) {
        let mut state = PageState::of(&id);
        state.url = existing.url().ok().map(|url| url.to_string());
        state.loading = Some(false);
        report(&existing, state);
        probe_history(&existing);
        return Ok(());
    }
    let window = app
        .get_window(crate::MAIN_WINDOW)
        .ok_or_else(|| "no main window".to_string())?;
    let opener = app.clone();
    let source = id.clone();
    #[cfg(target_os = "macos")]
    {
        let proxy = proxy.clone();
        app.run_on_main_thread(move || crate::webkit::route(&proxy))
            .map_err(|error| error.to_string())?;
    }
    let builder = profiled(WebviewBuilder::new(name, WebviewUrl::External(parse(&url)?)), &app, &proxy)?
        .initialization_script_for_all_frames(crate::PAGE_SCRIPT)
        .on_page_load(|webview, payload| {
            let mut state = PageState::of(&tab_of(webview.label()));
            state.url = Some(payload.url().to_string());
            state.loading = Some(matches!(payload.event(), PageLoadEvent::Started));
            report(&webview, state);
            probe_history(&webview);
        })
        .on_document_title_changed(|webview, title| {
            if let Some(json) = title.strip_prefix(SIGNAL_MARK) {
                signal(&webview, &tab_of(webview.label()), json);
                return;
            }
            let mut state = PageState::of(&tab_of(webview.label()));
            state.title = Some(title);
            report(&webview, state);
            probe_history(&webview);
        })
        .on_new_window(move |url, _| {
            let _ = opener.emit_to(
                crate::MAIN_WINDOW,
                OPEN_EVENT,
                OpenRequest {
                    id: source.clone(),
                    url: url.to_string(),
                },
            );
            NewWindowResponse::Deny
        });
    let webview = window
        .add_child(
            builder,
            LogicalPosition::new(x, y),
            LogicalSize::new(width, height),
        )
        .map_err(|error| error.to_string())?;
    watch_native(&webview);
    #[cfg(windows)]
    {
        sink(&webview);
        see_through(&app);
    }
    #[cfg(target_os = "linux")]
    {
        crate::webkit::route(&webview, &proxy);
        crate::webkit::place(&webview, x, y, width, height).map_err(|error| error.to_string())?;
    }
    #[cfg(any(target_os = "macos", target_os = "linux"))]
    crate::webkit::guard(&webview);
    Ok(())
}

#[derive(Clone, serde::Deserialize)]
pub struct Proxy {
    pub(crate) mode: String,
    pub(crate) url: String,
    bypass: String,
}

impl Proxy {
    pub(crate) fn bypass_hosts(&self) -> Vec<String> {
        self.bypass
            .split(',')
            .map(str::trim)
            .filter(|host| !host.is_empty())
            .map(str::to_string)
            .collect()
    }
}

fn profile_of<R: Runtime>(app: &AppHandle<R>) -> Result<std::path::PathBuf, String> {
    app.path()
        .app_local_data_dir()
        .map(|dir| dir.join(PROFILE_DIR))
        .map_err(|error| error.to_string())
}

fn profiled<R: Runtime>(
    builder: tauri::WebviewBuilder<R>,
    app: &AppHandle<R>,
    proxy: &Proxy,
) -> Result<tauri::WebviewBuilder<R>, String> {
    #[cfg(target_os = "macos")]
    let builder = builder.data_store_identifier(PROFILE_STORE);
    #[cfg(not(target_os = "macos"))]
    let builder = builder.data_directory(profile_of(app)?);
    #[cfg(windows)]
    {
        let bypass = proxy.bypass_hosts().join(";");
        let arguments = match proxy.mode.as_str() {
            "none" => Some(format!("{WEBVIEW_ARGUMENTS} --no-proxy-server")),
            "manual" if !proxy.url.trim().is_empty() => Some(match bypass.is_empty() {
                true => format!("{WEBVIEW_ARGUMENTS} --proxy-server={}", proxy.url.trim()),
                false => format!(
                    "{WEBVIEW_ARGUMENTS} --proxy-server={} --proxy-bypass-list={bypass}",
                    proxy.url.trim()
                ),
            }),
            _ => None,
        };
        Ok(match arguments {
            Some(arguments) => builder.additional_browser_args(&arguments),
            None => builder,
        })
    }
    #[cfg(not(windows))]
    {
        let _ = (app, proxy);
        Ok(builder)
    }
}

pub(crate) fn tabs_of<R: Runtime>(app: &AppHandle<R>) -> Vec<Webview<R>> {
    app.webviews()
        .into_values()
        .filter(|webview| webview.label().starts_with(LABEL_PREFIX))
        .collect()
}

pub(crate) fn hide_all<R: Runtime>(app: &AppHandle<R>) {
    for tab in tabs_of(app) {
        let _ = tab.hide();
    }
}

#[tauri::command]
pub async fn browser_restart<R: Runtime>(app: AppHandle<R>) -> Result<(), String> {
    let tabs = tabs_of(&app);
    let Some(first) = tabs.first() else {
        return Ok(());
    };
    #[cfg(windows)]
    let exited = {
        use webview2_com::BrowserProcessExitedEventHandler;
        use webview2_com::Microsoft::Web::WebView2::Win32::{ICoreWebView2Environment5, ICoreWebView2_2};
        use windows_core::Interface;

        let (sender, receiver) = tokio::sync::oneshot::channel::<()>();
        first
            .with_webview(move |platform| {
                let Ok(core) = (unsafe { platform.controller().CoreWebView2() }) else {
                    return;
                };
                let Some(environment) = core
                    .cast::<ICoreWebView2_2>()
                    .ok()
                    .and_then(|core| unsafe { core.Environment() }.ok())
                    .and_then(|environment| environment.cast::<ICoreWebView2Environment5>().ok())
                else {
                    return;
                };
                let mut waiting = Some((sender, environment.clone()));
                let handler = BrowserProcessExitedEventHandler::create(Box::new(move |_, _| {
                    if let Some((sender, _)) = waiting.take() {
                        let _ = sender.send(());
                    }
                    Ok(())
                }));
                let mut token = 0i64;
                unsafe {
                    let _ = environment.add_BrowserProcessExited(&handler, &mut token);
                }
            })
            .map_err(|error| error.to_string())?;
        receiver
    };
    #[cfg(not(windows))]
    let _ = first;
    for tab in tabs {
        tab.close().map_err(|error| error.to_string())?;
    }
    #[cfg(windows)]
    let _ = exited.await;
    Ok(())
}

#[tauri::command]
pub async fn browser_clear_data<R: Runtime>(app: AppHandle<R>) -> Result<(), String> {
    if let Some(tab) = tabs_of(&app).first() {
        return tab.clear_all_browsing_data().map_err(|error| error.to_string());
    }
    let profile = profile_of(&app)?;
    if profile.exists() {
        std::fs::remove_dir_all(&profile).map_err(|error| error.to_string())?;
    }
    Ok(())
}

fn size_of(path: &std::path::Path) -> u64 {
    let Ok(entries) = std::fs::read_dir(path) else {
        return 0;
    };
    entries
        .flatten()
        .map(|entry| match entry.file_type() {
            Ok(kind) if kind.is_dir() => size_of(&entry.path()),
            Ok(_) => entry.metadata().map(|meta| meta.len()).unwrap_or(0),
            Err(_) => 0,
        })
        .sum()
}

#[tauri::command]
pub async fn browser_data_size<R: Runtime>(app: AppHandle<R>) -> Result<u64, String> {
    let profile = profile_of(&app)?;
    #[cfg(windows)]
    let profile = profile.join(PROFILE_DATA);
    tauri::async_runtime::spawn_blocking(move || size_of(&profile))
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn browser_bounds<R: Runtime>(
    app: AppHandle<R>,
    id: String,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
) -> Result<(), String> {
    #[cfg(target_os = "linux")]
    {
        crate::webkit::place(&page(&app, &id)?, x, y, width, height).map_err(|error| error.to_string())
    }
    #[cfg(not(target_os = "linux"))]
    {
        use tauri::{LogicalPosition, LogicalSize, Rect};

        page(&app, &id)?
            .set_bounds(Rect {
                position: LogicalPosition::new(x, y).into(),
                size: LogicalSize::new(width, height).into(),
            })
            .map_err(|error| error.to_string())
    }
}

#[tauri::command]
pub async fn browser_visible<R: Runtime>(app: AppHandle<R>, id: String, visible: bool) -> Result<(), String> {
    let webview = page(&app, &id)?;
    let result = if visible { webview.show() } else { webview.hide() };
    result.map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn browser_navigate<R: Runtime>(app: AppHandle<R>, id: String, url: String) -> Result<(), String> {
    page(&app, &id)?
        .navigate(parse(&url)?)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn browser_back<R: Runtime>(app: AppHandle<R>, id: String) -> Result<(), String> {
    page(&app, &id)?
        .eval("history.back()")
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn browser_forward<R: Runtime>(app: AppHandle<R>, id: String) -> Result<(), String> {
    page(&app, &id)?
        .eval("history.forward()")
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn browser_reload<R: Runtime>(app: AppHandle<R>, id: String) -> Result<(), String> {
    page(&app, &id)?.reload().map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn browser_focus<R: Runtime>(app: AppHandle<R>, id: String) -> Result<(), String> {
    page(&app, &id)?.set_focus().map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn browser_close<R: Runtime>(app: AppHandle<R>, id: String) -> Result<(), String> {
    match app.get_webview(&label(&id)?) {
        Some(webview) => webview.close().map_err(|error| error.to_string()),
        None => Ok(()),
    }
}

#[tauri::command]
pub async fn browser_pick<R: Runtime>(app: AppHandle<R>, id: String, enabled: bool) -> Result<(), String> {
    page(&app, &id)?
        .eval(format!("window.__cconnect && window.__cconnect.pick({enabled})"))
        .map_err(|error| error.to_string())
}

#[cfg(any(target_os = "macos", target_os = "linux"))]
#[tauri::command]
pub async fn browser_capture<R: Runtime>(app: AppHandle<R>, id: String) -> Result<String, String> {
    use base64::Engine;

    let (sender, receiver) = tokio::sync::oneshot::channel::<Option<Vec<u8>>>();
    crate::webkit::capture(
        &page(&app, &id)?,
        Box::new(move |png| {
            let _ = sender.send(png);
        }),
    );
    let png = receiver.await.map_err(|_| "no answer".to_string())?.ok_or_else(|| "no capture".to_string())?;
    Ok(base64::engine::general_purpose::STANDARD.encode(png))
}

#[cfg(any(target_os = "macos", target_os = "linux"))]
#[tauri::command]
pub async fn browser_clear_site<R: Runtime>(app: AppHandle<R>, id: String, host: String) -> Result<(), String> {
    let (sender, receiver) = tokio::sync::oneshot::channel::<()>();
    crate::webkit::clear_site(
        &page(&app, &id)?,
        host,
        Box::new(move || {
            let _ = sender.send(());
        }),
    );
    receiver.await.map_err(|_| "no answer".to_string())
}

#[cfg(any(target_os = "macos", target_os = "linux"))]
#[tauri::command]
pub async fn browser_agent<R: Runtime>(app: AppHandle<R>, id: String, agent: Option<String>) -> Result<(), String> {
    crate::webkit::agent(&page(&app, &id)?, agent);
    Ok(())
}

#[tauri::command]
pub async fn browser_zoom<R: Runtime>(app: AppHandle<R>, id: String, zoom: f64) -> Result<(), String> {
    page(&app, &id)?
        .set_zoom(zoom)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn browser_layer<R: Runtime>(
    app: AppHandle<R>,
    hole: Option<Area>,
    radius: Option<f64>,
    cover: Vec<Area>,
) -> Result<bool, String> {
    #[cfg(windows)]
    {
        let main = app
            .get_webview(crate::MAIN_WINDOW)
            .ok_or_else(|| "no main webview".to_string())?;
        let scale = main.window().scale_factor().map_err(|error| error.to_string())?;
        main.with_webview(move |platform| {
            if let Some(host) = host_of(&platform) {
                carve(host, scale, hole, radius.unwrap_or(0.0), &cover);
            }
        })
        .map_err(|error| error.to_string())?;
        Ok(true)
    }
    #[cfg(not(windows))]
    {
        let _ = (app, hole, radius, cover);
        Ok(false)
    }
}

#[tauri::command]
pub async fn browser_cdp<R: Runtime>(
    app: AppHandle<R>,
    id: String,
    method: String,
    params: serde_json::Value,
) -> Result<serde_json::Value, String> {
    #[cfg(windows)]
    {
        use webview2_com::CallDevToolsProtocolMethodCompletedHandler;
        use windows_core::{HSTRING, PCWSTR};

        let (sender, receiver) = tokio::sync::oneshot::channel::<Result<String, String>>();
        page(&app, &id)?
            .with_webview(move |platform| {
                let Ok(core) = (unsafe { platform.controller().CoreWebView2() }) else {
                    let _ = sender.send(Err("no page".to_string()));
                    return;
                };
                let done = CallDevToolsProtocolMethodCompletedHandler::create(Box::new(move |result, json| {
                    let _ = sender.send(result.map(|_| json.clone()).map_err(|_| json));
                    Ok(())
                }));
                let (name, body) = (HSTRING::from(method), HSTRING::from(params.to_string()));
                let _ = unsafe {
                    core.CallDevToolsProtocolMethod(PCWSTR(name.as_ptr()), PCWSTR(body.as_ptr()), &done)
                };
            })
            .map_err(|error| error.to_string())?;
        let answer = receiver.await.map_err(|_| "no answer".to_string())??;
        serde_json::from_str(&answer).map_err(|error| error.to_string())
    }
    #[cfg(not(windows))]
    {
        let _ = (app, id, method, params);
        Err("the devtools protocol is not available here".to_string())
    }
}

#[tauri::command]
pub async fn browser_release<R: Runtime>(app: AppHandle<R>) -> Result<(), String> {
    app.get_webview(crate::MAIN_WINDOW)
        .ok_or_else(|| "no main webview".to_string())?
        .set_focus()
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn browser_keys(state: State<'_, BrowserKeys>, keys: Vec<String>) -> Result<(), String> {
    let mut wanted = state.0.lock().map_err(|error| error.to_string())?;
    *wanted = keys.into_iter().collect();
    Ok(())
}
