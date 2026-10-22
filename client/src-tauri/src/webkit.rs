use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;

use tauri::{AppHandle, Manager, Runtime, Webview};

use crate::shield::{RuleList, Shield};

const RULES_DIR: &str = "rules";

static GENERATION: AtomicU64 = AtomicU64::new(0);

fn current(generation: u64) -> bool {
    GENERATION.load(Ordering::SeqCst) == generation
}

fn rules_of<R: Runtime>(app: &AppHandle<R>) -> Option<(Arc<Vec<RuleList>>, String)> {
    let dir = crate::shield::store_of(app).ok()?.join(RULES_DIR);
    std::fs::create_dir_all(&dir).ok()?;
    Some((app.state::<Shield>().rule_lists(), dir.to_string_lossy().into_owned()))
}

pub fn guard<R: Runtime>(webview: &Webview<R>) {
    let Some((lists, dir)) = rules_of(webview.app_handle()) else {
        return;
    };
    let generation = GENERATION.load(Ordering::SeqCst);
    let _ = webview.with_webview(move |platform| platform::apply(platform, &dir, &lists, generation));
}

pub fn guard_all<R: Runtime>(app: &AppHandle<R>) {
    let generation = GENERATION.fetch_add(1, Ordering::SeqCst) + 1;
    let Some((lists, dir)) = rules_of(app) else {
        return;
    };
    for tab in crate::browser::tabs_of(app) {
        let (lists, dir) = (lists.clone(), dir.clone());
        let _ = tab.with_webview(move |platform| platform::apply(platform, &dir, &lists, generation));
    }
    let _ = app.run_on_main_thread(move || platform::prepare(&dir, &lists));
}

pub fn agent<R: Runtime>(webview: &Webview<R>, agent: Option<String>) {
    let _ = webview.with_webview(move |platform| platform::agent(platform, agent.as_deref()));
}

#[cfg(target_os = "macos")]
pub use platform::route;

#[cfg(target_os = "linux")]
pub fn route<R: Runtime>(webview: &Webview<R>, proxy: &crate::browser::Proxy) {
    let (mode, url, bypass) = (proxy.mode.clone(), proxy.url.trim().to_string(), proxy.bypass_hosts());
    let _ = webview.with_webview(move |platform| platform::route(platform, &mode, &url, &bypass));
}

#[cfg(target_os = "macos")]
mod platform {
    use std::ffi::{c_char, c_int, c_void, CStr, CString};
    use std::rc::Rc;

    use block2::RcBlock;
    use objc2::rc::Retained;
    use objc2::MainThreadMarker;
    use objc2_foundation::{ns_string, NSArray, NSError, NSObject, NSObjectNSKeyValueCoding, NSString, NSURL, NSUUID};
    use objc2_web_kit::{WKContentRuleList, WKContentRuleListStore, WKUserContentController, WKWebView, WKWebsiteDataStore};
    use tauri::webview::PlatformWebview;
    use tauri::Url;

    use super::current;
    use crate::browser::{Proxy, PROFILE_STORE};
    use crate::shield::{ours, RuleList};

    const NETWORK: &CStr = c"/System/Library/Frameworks/Network.framework/Network";
    const RTLD_LAZY: c_int = 1;

    type CreateHost = unsafe extern "C" fn(*const c_char, *const c_char) -> *mut NSObject;
    type CreateHttp = unsafe extern "C" fn(*mut NSObject, *mut NSObject) -> *mut NSObject;
    type CreateSocks = unsafe extern "C" fn(*mut NSObject) -> *mut NSObject;
    type Exclude = unsafe extern "C" fn(*mut NSObject, *const c_char);

    extern "C" {
        fn dlopen(path: *const c_char, mode: c_int) -> *mut c_void;
        fn dlsym(handle: *mut c_void, symbol: *const c_char) -> *mut c_void;
    }

    struct Network {
        host: CreateHost,
        http: CreateHttp,
        socks: CreateSocks,
        exclude: Exclude,
    }

    impl Network {
        fn load() -> Option<Self> {
            let handle = unsafe { dlopen(NETWORK.as_ptr(), RTLD_LAZY) };
            if handle.is_null() {
                return None;
            }
            let find = |name: &CStr| {
                let found = unsafe { dlsym(handle, name.as_ptr()) };
                (!found.is_null()).then_some(found)
            };
            unsafe {
                Some(Self {
                    host: std::mem::transmute::<*mut c_void, CreateHost>(find(c"nw_endpoint_create_host")?),
                    http: std::mem::transmute::<*mut c_void, CreateHttp>(find(c"nw_proxy_config_create_http_connect")?),
                    socks: std::mem::transmute::<*mut c_void, CreateSocks>(find(c"nw_proxy_config_create_socksv5")?),
                    exclude: std::mem::transmute::<*mut c_void, Exclude>(find(c"nw_proxy_config_add_excluded_domain")?),
                })
            }
        }

        fn config(&self, proxy: &Proxy) -> Option<Retained<NSObject>> {
            let url = Url::parse(proxy.url.trim()).ok()?;
            let host = CString::new(url.host_str()?).ok()?;
            let port = CString::new(url.port_or_known_default()?.to_string()).ok()?;
            unsafe {
                let endpoint = Retained::from_raw((self.host)(host.as_ptr(), port.as_ptr()))?;
                let raw = match url.scheme() {
                    "socks" | "socks5" => (self.socks)(Retained::as_ptr(&endpoint).cast_mut()),
                    _ => (self.http)(Retained::as_ptr(&endpoint).cast_mut(), std::ptr::null_mut()),
                };
                let config = Retained::from_raw(raw)?;
                for domain in proxy.bypass_hosts() {
                    if let Ok(domain) = CString::new(domain) {
                        (self.exclude)(Retained::as_ptr(&config).cast_mut(), domain.as_ptr());
                    }
                }
                Some(config)
            }
        }
    }

    pub fn route(proxy: &Proxy) {
        let Some(mtm) = MainThreadMarker::new() else {
            return;
        };
        if !objc2::available!(macos = 14.0) {
            return;
        }
        let configs = match proxy.mode.as_str() {
            "manual" => Network::load()
                .and_then(|network| network.config(proxy))
                .map(|config| NSArray::from_retained_slice(&[config]))
                .unwrap_or_else(NSArray::new),
            _ => NSArray::new(),
        };
        unsafe {
            let store = WKWebsiteDataStore::dataStoreForIdentifier(&NSUUID::from_bytes(PROFILE_STORE), mtm);
            store.setValue_forKey(Some(&configs), ns_string!("proxyConfigurations"));
        }
    }

    pub fn agent(platform: PlatformWebview, agent: Option<&str>) {
        let Some(view) = (unsafe { Retained::retain(platform.inner().cast::<WKWebView>()) }) else {
            return;
        };
        let agent = agent.map(NSString::from_str);
        unsafe {
            view.setCustomUserAgent(agent.as_deref());
            view.reload();
        }
    }

    fn store(dir: &str) -> Option<Retained<WKContentRuleListStore>> {
        let mtm = MainThreadMarker::new()?;
        let url = NSURL::fileURLWithPath_isDirectory(&NSString::from_str(dir), true);
        unsafe { WKContentRuleListStore::storeWithURL(Some(&url), mtm) }
    }

    fn load(store: &Retained<WKContentRuleListStore>, list: &RuleList, done: Rc<dyn Fn(&WKContentRuleList)>) {
        let identifier = NSString::from_str(&list.identifier);
        let json = NSString::from_str(&list.json);
        let compiler = store.clone();
        let wanted = identifier.clone();
        let found = RcBlock::new(move |found: *mut WKContentRuleList, _: *mut NSError| {
            if let Some(found) = unsafe { found.as_ref() } {
                done(found);
                return;
            }
            let done = done.clone();
            let made = RcBlock::new(move |made: *mut WKContentRuleList, _: *mut NSError| {
                if let Some(made) = unsafe { made.as_ref() } {
                    done(made);
                }
            });
            unsafe {
                compiler.compileContentRuleListForIdentifier_encodedContentRuleList_completionHandler(
                    Some(&wanted),
                    Some(&json),
                    Some(&made),
                )
            };
        });
        unsafe { store.lookUpContentRuleListForIdentifier_completionHandler(Some(&identifier), Some(&found)) };
    }

    pub fn apply(platform: PlatformWebview, dir: &str, lists: &[RuleList], generation: u64) {
        let Some(controller) =
            (unsafe { Retained::retain(platform.controller().cast::<WKUserContentController>()) })
        else {
            return;
        };
        unsafe { controller.removeAllContentRuleLists() };
        let Some(store) = store(dir) else {
            return;
        };
        for list in lists {
            let controller = controller.clone();
            load(
                &store,
                list,
                Rc::new(move |found: &WKContentRuleList| {
                    if current(generation) {
                        unsafe { controller.addContentRuleList(found) };
                    }
                }),
            );
        }
    }

    pub fn prepare(dir: &str, lists: &[RuleList]) {
        let Some(store) = store(dir) else {
            return;
        };
        for list in lists {
            load(&store, list, Rc::new(|_: &WKContentRuleList| {}));
        }
        let keep: Vec<String> = lists.iter().map(|list| list.identifier.clone()).collect();
        let remover = store.clone();
        let listed = RcBlock::new(move |identifiers: *mut NSArray<NSString>| {
            let Some(identifiers) = (unsafe { identifiers.as_ref() }) else {
                return;
            };
            for identifier in identifiers.iter() {
                let name = identifier.to_string();
                if ours(&name) && !keep.contains(&name) {
                    let removed = RcBlock::new(|_: *mut NSError| {});
                    unsafe { remover.removeContentRuleListForIdentifier_completionHandler(Some(&identifier), Some(&removed)) };
                }
            }
        });
        unsafe { store.getAvailableContentRuleListIdentifiers(Some(&listed)) };
    }
}

#[cfg(target_os = "linux")]
mod platform {
    use std::ffi::{c_void, CStr, CString};
    use std::ptr;

    use tauri::webview::PlatformWebview;
    use webkit2gtk::gio::ffi::GAsyncResult;
    use webkit2gtk::glib::gobject_ffi::GObject;
    use webkit2gtk::glib::object::ObjectType;
    use webkit2gtk::glib::translate::{FromGlibPtrFull, ToGlibPtr};
    use webkit2gtk::glib::{self, Bytes, Object};
    use webkit2gtk::{
        NetworkProxyMode, NetworkProxySettings, SettingsExt, UserContentManager, UserContentManagerExt,
        WebContextExt, WebViewExt, WebsiteDataManagerExt,
    };
    use webkit2gtk_sys as sys;

    use super::current;
    use crate::shield::{ours, RuleList};

    struct Pending {
        store: Object,
        manager: Option<UserContentManager>,
        identifier: CString,
        json: Bytes,
        generation: u64,
    }

    struct Pruning {
        keep: Vec<String>,
    }

    fn store(dir: &str) -> Option<Object> {
        let path = CString::new(dir).ok()?;
        let raw = unsafe { sys::webkit_user_content_filter_store_new(path.as_ptr()) };
        (!raw.is_null()).then(|| unsafe { Object::from_glib_full(raw.cast::<GObject>()) })
    }

    fn handle(store: &Object) -> *mut sys::WebKitUserContentFilterStore {
        store.as_ptr().cast()
    }

    unsafe fn attach(pending: &Pending, filter: *mut sys::WebKitUserContentFilter) {
        if let Some(manager) = &pending.manager {
            if current(pending.generation) {
                sys::webkit_user_content_manager_add_filter(manager.to_glib_none().0, filter);
            }
        }
        sys::webkit_user_content_filter_unref(filter);
    }

    unsafe extern "C" fn loaded(source: *mut GObject, result: *mut GAsyncResult, data: *mut c_void) {
        let pending = Box::from_raw(data.cast::<Pending>());
        let mut error = ptr::null_mut();
        let filter = sys::webkit_user_content_filter_store_load_finish(source.cast(), result, &mut error);
        if !error.is_null() {
            glib::ffi::g_error_free(error);
        }
        if !filter.is_null() {
            attach(&pending, filter);
            return;
        }
        let pending = Box::into_raw(pending);
        sys::webkit_user_content_filter_store_save(
            handle(&(*pending).store),
            (*pending).identifier.as_ptr(),
            (*pending).json.to_glib_none().0,
            ptr::null_mut(),
            Some(saved),
            pending.cast(),
        );
    }

    unsafe extern "C" fn saved(source: *mut GObject, result: *mut GAsyncResult, data: *mut c_void) {
        let pending = Box::from_raw(data.cast::<Pending>());
        let mut error = ptr::null_mut();
        let filter = sys::webkit_user_content_filter_store_save_finish(source.cast(), result, &mut error);
        if !error.is_null() {
            glib::ffi::g_error_free(error);
        }
        if !filter.is_null() {
            attach(&pending, filter);
        }
    }

    unsafe extern "C" fn listed(source: *mut GObject, result: *mut GAsyncResult, data: *mut c_void) {
        let pruning = Box::from_raw(data.cast::<Pruning>());
        let names = sys::webkit_user_content_filter_store_fetch_identifiers_finish(source.cast(), result);
        if names.is_null() {
            return;
        }
        let mut at = names;
        while !(*at).is_null() {
            let name = CStr::from_ptr(*at).to_string_lossy();
            if ours(&name) && !pruning.keep.iter().any(|kept| *kept == name) {
                sys::webkit_user_content_filter_store_remove(source.cast(), *at, ptr::null_mut(), None, ptr::null_mut());
            }
            at = at.add(1);
        }
        glib::ffi::g_strfreev(names);
    }

    fn load(store: &Object, list: &RuleList, manager: Option<UserContentManager>, generation: u64) {
        let Ok(identifier) = CString::new(list.identifier.as_str()) else {
            return;
        };
        let pending = Box::into_raw(Box::new(Pending {
            store: store.clone(),
            manager,
            identifier,
            json: Bytes::from(list.json.as_bytes()),
            generation,
        }));
        unsafe {
            sys::webkit_user_content_filter_store_load(
                handle(store),
                (*pending).identifier.as_ptr(),
                ptr::null_mut(),
                Some(loaded),
                pending.cast(),
            )
        };
    }

    pub fn apply(platform: PlatformWebview, dir: &str, lists: &[RuleList], generation: u64) {
        let Some(manager) = platform.inner().user_content_manager() else {
            return;
        };
        manager.remove_all_filters();
        let Some(store) = store(dir) else {
            return;
        };
        for list in lists {
            load(&store, list, Some(manager.clone()), generation);
        }
    }

    pub fn prepare(dir: &str, lists: &[RuleList]) {
        let Some(store) = store(dir) else {
            return;
        };
        for list in lists {
            load(&store, list, None, 0);
        }
        let pruning = Box::into_raw(Box::new(Pruning {
            keep: lists.iter().map(|list| list.identifier.clone()).collect(),
        }));
        unsafe {
            sys::webkit_user_content_filter_store_fetch_identifiers(
                handle(&store),
                ptr::null_mut(),
                Some(listed),
                pruning.cast(),
            )
        };
    }

    pub fn agent(platform: PlatformWebview, agent: Option<&str>) {
        let view = platform.inner();
        if let Some(settings) = WebViewExt::settings(&view) {
            settings.set_user_agent(agent);
        }
        view.reload();
    }

    pub fn route(platform: PlatformWebview, mode: &str, url: &str, bypass: &[String]) {
        let Some(manager) = platform.inner().context().and_then(|context| context.website_data_manager()) else {
            return;
        };
        match mode {
            "none" => manager.set_network_proxy_settings(NetworkProxyMode::NoProxy, None),
            "manual" if !url.is_empty() => {
                let hosts: Vec<&str> = bypass.iter().map(String::as_str).collect();
                let mut settings = NetworkProxySettings::new(Some(url), &hosts);
                manager.set_network_proxy_settings(NetworkProxyMode::Custom, Some(&mut settings));
            }
            _ => manager.set_network_proxy_settings(NetworkProxyMode::Default, None),
        }
    }
}
