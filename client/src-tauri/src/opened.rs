use std::path::{Path, PathBuf};
use std::sync::{LazyLock, Mutex};

use base64::Engine;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager, State};

const OPENED_EVENT: &str = "opened-files";
const LINKS_EVENT: &str = "opened-links";
const LINK_SCHEME: &str = "cconnect:";

#[derive(Deserialize)]
struct PackSchema {
    extension: String,
    mime: String,
}

static SCHEMA: LazyLock<PackSchema> = LazyLock::new(|| {
    serde_json::from_str(include_str!("../../../backend/core/packs/schema.json")).expect("pack schema")
});

#[derive(Default)]
pub struct Opened {
    files: Mutex<Vec<PathBuf>>,
    links: Mutex<Vec<String>>,
}

#[derive(Serialize)]
pub struct OpenedFile {
    name: String,
    mime: String,
    data: String,
}

fn is_pack(path: &Path) -> bool {
    let extension = SCHEMA.extension.trim_start_matches('.');
    path.is_file() && path.extension().is_some_and(|found| found.eq_ignore_ascii_case(extension))
}

pub fn hold(app: &AppHandle, paths: impl IntoIterator<Item = PathBuf>) {
    let packs: Vec<PathBuf> = paths.into_iter().filter(|path| is_pack(path)).collect();
    if packs.is_empty() {
        return;
    }
    if let Ok(mut held) = app.state::<Opened>().files.lock() {
        held.extend(packs);
    }
    let _ = app.emit(OPENED_EVENT, ());
}

pub fn hold_links(app: &AppHandle, args: impl IntoIterator<Item = String>) {
    let links: Vec<String> = args
        .into_iter()
        .filter(|arg| arg.to_ascii_lowercase().starts_with(LINK_SCHEME))
        .collect();
    if links.is_empty() {
        return;
    }
    if let Ok(mut held) = app.state::<Opened>().links.lock() {
        held.extend(links);
    }
    let _ = app.emit(LINKS_EVENT, ());
}

pub fn take(app: &AppHandle, args: Vec<String>) {
    hold(app, args.iter().map(PathBuf::from));
    hold_links(app, args);
}

#[tauri::command]
pub fn opened_links(state: State<'_, Opened>) -> Vec<String> {
    state.links.lock().map(|mut held| std::mem::take(&mut *held)).unwrap_or_default()
}

#[tauri::command]
pub fn opened_files(state: State<'_, Opened>) -> Vec<OpenedFile> {
    let paths = state.files.lock().map(|mut held| std::mem::take(&mut *held)).unwrap_or_default();
    paths
        .into_iter()
        .filter_map(|path| {
            let data = std::fs::read(&path).ok()?;
            Some(OpenedFile {
                name: path.file_name()?.to_string_lossy().into_owned(),
                mime: SCHEMA.mime.clone(),
                data: base64::engine::general_purpose::STANDARD.encode(data),
            })
        })
        .collect()
}
