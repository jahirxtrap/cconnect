use std::path::{Path, PathBuf};
use std::sync::{LazyLock, Mutex};

use base64::Engine;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager, State};

const OPENED_EVENT: &str = "opened-files";

#[derive(Deserialize)]
struct PackSchema {
    extension: String,
    mime: String,
}

static SCHEMA: LazyLock<PackSchema> = LazyLock::new(|| {
    serde_json::from_str(include_str!("../../../backend/core/packs/schema.json")).expect("pack schema")
});

#[derive(Default)]
pub struct Opened(Mutex<Vec<PathBuf>>);

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
    if let Ok(mut held) = app.state::<Opened>().0.lock() {
        held.extend(packs);
    }
    let _ = app.emit(OPENED_EVENT, ());
}

#[tauri::command]
pub fn opened_files(state: State<'_, Opened>) -> Vec<OpenedFile> {
    let paths = state.0.lock().map(|mut held| std::mem::take(&mut *held)).unwrap_or_default();
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
