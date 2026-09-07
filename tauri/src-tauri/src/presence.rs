use serde::Deserialize;

#[cfg(desktop)]
use discord_rich_presence::{activity, DiscordIpc, DiscordIpcClient};

const APP_ID: &str = "1546308287077548083";

#[derive(Default)]
pub struct Presence {
    #[cfg(desktop)]
    client: std::sync::Mutex<Option<DiscordIpcClient>>,
}

#[derive(Deserialize)]
pub struct Lines {
    details: Option<String>,
    state: Option<String>,
    started_at: Option<i64>,
    small_image: Option<String>,
    small_text: Option<String>,
}

#[cfg(desktop)]
fn connected(slot: &mut Option<DiscordIpcClient>) -> bool {
    if slot.is_some() {
        return true;
    }
    if APP_ID.is_empty() {
        return false;
    }
    let Ok(mut client) = DiscordIpcClient::new(APP_ID) else {
        return false;
    };
    if client.connect().is_err() {
        return false;
    }
    *slot = Some(client);
    true
}

#[cfg(desktop)]
fn build(lines: &Lines) -> activity::Activity<'_> {
    let mut activity = activity::Activity::new();
    if let Some(details) = lines.details.as_deref().filter(|text| !text.is_empty()) {
        activity = activity.details(details);
    }
    if let Some(text) = lines.state.as_deref().filter(|text| !text.is_empty()) {
        activity = activity.state(text);
    }
    if let Some(started) = lines.started_at {
        activity = activity.timestamps(activity::Timestamps::new().start(started));
    }
    let mut assets = activity::Assets::new().large_image("app");
    if let Some(image) = lines.small_image.as_deref().filter(|text| !text.is_empty()) {
        assets = assets.small_image(image);
    }
    if let Some(text) = lines.small_text.as_deref().filter(|text| !text.is_empty()) {
        assets = assets.small_text(text);
    }
    activity.assets(assets)
}

#[tauri::command]
pub fn presence_set(state: tauri::State<'_, Presence>, lines: Lines) -> bool {
    #[cfg(desktop)]
    {
        let Ok(mut slot) = state.client.lock() else {
            return false;
        };
        if !connected(&mut slot) {
            return false;
        }
        let activity = build(&lines);
        let client = slot.as_mut().expect("connected");
        if client.set_activity(activity).is_err() {
            let _ = client.close();
            *slot = None;
            return false;
        }
        true
    }
    #[cfg(not(desktop))]
    {
        let _ = (state, lines);
        false
    }
}

#[tauri::command]
pub fn presence_clear(state: tauri::State<'_, Presence>) {
    #[cfg(desktop)]
    {
        let Ok(mut slot) = state.client.lock() else {
            return;
        };
        if let Some(mut client) = slot.take() {
            let _ = client.clear_activity();
            let _ = client.close();
        }
    }
    #[cfg(not(desktop))]
    let _ = state;
}

#[cfg(desktop)]
pub fn shutdown(state: &tauri::State<'_, Presence>) {
    if let Ok(mut slot) = state.client.lock() {
        if let Some(mut client) = slot.take() {
            let _ = client.clear_activity();
            let _ = client.close();
        }
    }
}
