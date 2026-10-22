use std::collections::HashSet;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, RwLock};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use serde::Serialize;
use tauri::{AppHandle, Manager, Runtime, State};

#[cfg(not(any(target_os = "macos", target_os = "linux")))]
mod engine;
#[cfg(not(any(target_os = "macos", target_os = "linux")))]
use engine as filters;
#[cfg(any(target_os = "macos", target_os = "linux"))]
mod rules;
#[cfg(any(target_os = "macos", target_os = "linux"))]
use rules as filters;
#[cfg(any(target_os = "macos", target_os = "linux"))]
pub use rules::{ours, RuleList};

const LISTS: &[(&str, &[&str])] = &[
    ("easylist", &["https://easylist.to/easylist/easylist.txt"]),
    ("easyprivacy", &["https://easylist.to/easylist/easyprivacy.txt"]),
    (
        "ublock",
        &[
            "https://ublockorigin.github.io/uAssets/filters/filters.txt",
            "https://ublockorigin.github.io/uAssets/filters/unbreak.txt",
        ],
    ),
    ("annoyances", &["https://easylist.to/easylist/fanboy-annoyance.txt"]),
    ("cookies", &["https://secure.fanboy.co.nz/fanboy-cookiemonster.txt"]),
];
const PRIVATE_SITES: &[&str] = &[
    "^https?://localhost[:/]",
    "^https?://[^/]*\\.localhost[:/]",
    "^https?://[^/]*\\.local[:/]",
    "^https?://127\\.[0-9]+\\.[0-9]+\\.[0-9]+[:/]",
    "^https?://10\\.[0-9]+\\.[0-9]+\\.[0-9]+[:/]",
    "^https?://192\\.168\\.[0-9]+\\.[0-9]+[:/]",
    "^https?://169\\.254\\.[0-9]+\\.[0-9]+[:/]",
    "^https?://172\\.1[6-9]\\.[0-9]+\\.[0-9]+[:/]",
    "^https?://172\\.2[0-9]\\.[0-9]+\\.[0-9]+[:/]",
    "^https?://172\\.3[01]\\.[0-9]+\\.[0-9]+[:/]",
    "^https?://100\\.6[4-9]\\.[0-9]+\\.[0-9]+[:/]",
    "^https?://100\\.[7-9][0-9]\\.[0-9]+\\.[0-9]+[:/]",
    "^https?://100\\.1[01][0-9]\\.[0-9]+\\.[0-9]+[:/]",
    "^https?://100\\.12[0-7]\\.[0-9]+\\.[0-9]+[:/]",
    "^https?://\\[::1\\]",
];
const CACHE_DIR: &str = "Browser Shield";
const STALE: Duration = Duration::from_secs(24 * 60 * 60);

#[derive(Default)]
pub struct Shield {
    filters: RwLock<Option<Arc<filters::Compiled>>>,
    loaded: RwLock<Vec<String>>,
    enabled: AtomicBool,
    allowed: RwLock<HashSet<String>>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ShieldState {
    ready: bool,
    updated: Option<u64>,
}

impl Shield {
    fn current(&self) -> Option<Arc<filters::Compiled>> {
        if !self.enabled.load(Ordering::Relaxed) {
            return None;
        }
        self.filters.read().ok()?.clone()
    }
}

fn chosen(lists: &[String]) -> Vec<String> {
    LISTS
        .iter()
        .filter(|(id, _)| lists.iter().any(|item| item == id))
        .map(|(id, _)| id.to_string())
        .collect()
}

pub fn store_of<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, String> {
    app.path()
        .app_local_data_dir()
        .map(|dir| dir.join(CACHE_DIR))
        .map_err(|error| error.to_string())
}

fn cache_of<R: Runtime>(app: &AppHandle<R>, lists: &[String]) -> Result<PathBuf, String> {
    Ok(store_of(app)?.join(format!("{}.{}", lists.join("+"), filters::EXTENSION)))
}

fn age_of(path: &PathBuf) -> Option<u64> {
    let modified = std::fs::metadata(path).ok()?.modified().ok()?;
    modified.duration_since(UNIX_EPOCH).ok().map(|since| since.as_secs())
}

async fn compile(lists: Vec<String>) -> Result<filters::Compiled, String> {
    let client = tauri_plugin_http::reqwest::Client::new();
    let mut texts = Vec::new();
    for (_, sources) in LISTS.iter().filter(|(id, _)| lists.iter().any(|item| item == id)) {
        for source in sources.iter() {
            let text = client
                .get(*source)
                .send()
                .await
                .and_then(|response| response.error_for_status())
                .map_err(|error| error.to_string())?
                .text()
                .await
                .map_err(|error| error.to_string())?;
            texts.push(text);
        }
    }
    tauri::async_runtime::spawn_blocking(move || filters::build(texts))
        .await
        .map_err(|error| error.to_string())
}

fn install<R: Runtime>(app: &AppHandle<R>, compiled: filters::Compiled, lists: Vec<String>) -> Option<()> {
    let shield = app.state::<Shield>();
    *shield.filters.write().ok()? = Some(Arc::new(compiled));
    *shield.loaded.write().ok()? = lists;
    Some(())
}

async fn refresh<R: Runtime>(app: &AppHandle<R>, lists: Vec<String>) -> Result<Option<u64>, String> {
    let path = cache_of(app, &lists)?;
    let compiled = compile(lists.clone()).await?;
    if let Some(dir) = path.parent() {
        std::fs::create_dir_all(dir).map_err(|error| error.to_string())?;
    }
    std::fs::write(&path, filters::encode(&compiled)).map_err(|error| error.to_string())?;
    install(app, compiled, lists);
    Ok(age_of(&path))
}

fn restore<R: Runtime>(app: &AppHandle<R>, lists: &[String]) -> Option<u64> {
    let path = cache_of(app, lists).ok()?;
    let compiled = filters::decode(&std::fs::read(&path).ok()?)?;
    install(app, compiled, lists.to_vec())?;
    age_of(&path)
}

fn stale(updated: Option<u64>) -> bool {
    let now = SystemTime::now().duration_since(UNIX_EPOCH).map(|since| since.as_secs()).unwrap_or(0);
    updated.map_or(true, |at| now.saturating_sub(at) > STALE.as_secs())
}

fn applied<R: Runtime>(app: &AppHandle<R>) {
    #[cfg(any(target_os = "macos", target_os = "linux"))]
    crate::webkit::guard_all(app);
    #[cfg(not(any(target_os = "macos", target_os = "linux")))]
    let _ = app;
}

#[tauri::command]
pub async fn browser_shield<R: Runtime>(
    app: AppHandle<R>,
    shield: State<'_, Shield>,
    enabled: bool,
    lists: Vec<String>,
    allowed: Vec<String>,
) -> Result<ShieldState, String> {
    shield.enabled.store(enabled, Ordering::Relaxed);
    *shield.allowed.write().map_err(|error| error.to_string())? =
        allowed.iter().map(|host| host.trim_start_matches("www.").to_lowercase()).collect();
    let lists = chosen(&lists);
    if !enabled || lists.is_empty() {
        applied(&app);
        return Ok(ShieldState { ready: false, updated: None });
    }
    let current = shield.loaded.read().map_err(|error| error.to_string())?.clone();
    let loaded = current == lists && shield.filters.read().map(|filters| filters.is_some()).unwrap_or(false);
    let updated = if loaded {
        age_of(&cache_of(&app, &lists)?)
    } else {
        match restore(&app, &lists) {
            Some(updated) => Some(updated),
            None => refresh(&app, lists.clone()).await?,
        }
    };
    applied(&app);
    if stale(updated) {
        let (app, lists) = (app.clone(), lists.clone());
        tauri::async_runtime::spawn(async move {
            if refresh(&app, lists).await.is_ok() {
                applied(&app);
            }
        });
    }
    Ok(ShieldState { ready: true, updated })
}

#[tauri::command]
pub async fn browser_shield_update<R: Runtime>(app: AppHandle<R>, lists: Vec<String>) -> Result<ShieldState, String> {
    let lists = chosen(&lists);
    if lists.is_empty() {
        return Ok(ShieldState { ready: false, updated: None });
    }
    let updated = refresh(&app, lists).await?;
    applied(&app);
    Ok(ShieldState { ready: true, updated })
}
