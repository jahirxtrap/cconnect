use std::sync::{Arc, Mutex};

use serde::Serialize;
use tauri::{AppHandle, Emitter, Runtime, State};
use tokio::sync::{Mutex as AsyncMutex, MutexGuard};

use crate::speechd::{Client, Finished, MessageId, Voice};

const EVENT: &str = "speech";
const DONE: &str = "done";
const RATE_SPAN: f64 = 2.5;
const RATE_LIMIT: f64 = 100.0;
const LANGUAGE_SEPARATOR: char = '-';
const LINE_BREAK: &str = "\n";

#[derive(Serialize, Clone)]
pub struct SpeechVoice {
    id: String,
    label: String,
    language: String,
}

#[derive(Serialize, Clone)]
struct SpeechEvent {
    id: String,
    kind: &'static str,
}

type Current = Arc<Mutex<Option<(String, MessageId)>>>;

#[derive(Default)]
pub struct Speech {
    client: AsyncMutex<Option<Client>>,
    voices: Mutex<Vec<Voice>>,
    current: Current,
}

fn finish<R: Runtime>(app: &AppHandle<R>, current: &Current, finished: Finished) {
    let Ok(mut current) = current.lock() else {
        return;
    };
    let matched = match (&finished, current.as_ref()) {
        (Finished::Message(id), Some((_, speaking))) => id == speaking,
        (Finished::Closed, Some(_)) => true,
        _ => false,
    };
    if let (true, Some((key, _))) = (matched, current.take()) {
        let _ = app.emit_to(crate::MAIN_WINDOW, EVENT, SpeechEvent { id: key, kind: DONE });
    }
}

async fn ready<'a, R: Runtime>(speech: &'a Speech, app: &AppHandle<R>) -> Result<MutexGuard<'a, Option<Client>>, String> {
    let mut client = speech.client.lock().await;
    if client.is_none() {
        let (app, current) = (app.clone(), speech.current.clone());
        *client = Some(Client::connect(move |finished| finish(&app, &current, finished)).await?);
    }
    Ok(client)
}

fn kept<T>(client: &mut Option<Client>, result: Result<T, String>) -> Result<T, String> {
    if result.is_err() {
        *client = None;
    }
    result
}

async fn listed(speech: &Speech, client: &mut Option<Client>) -> Result<Vec<Voice>, String> {
    let known = speech.voices.lock().map(|voices| voices.clone()).unwrap_or_default();
    if !known.is_empty() {
        return Ok(known);
    }
    let Some(connected) = client.as_mut() else {
        return Ok(Vec::new());
    };
    let fetched = connected.voices().await;
    let voices = kept(client, fetched)?;
    if let Ok(mut stored) = speech.voices.lock() {
        *stored = voices.clone();
    }
    Ok(voices)
}

fn base(language: &str) -> String {
    language.split(LANGUAGE_SEPARATOR).next().unwrap_or(language).to_ascii_lowercase()
}

fn pick(voices: &[Voice], wanted: &str, language: &str) -> Option<String> {
    voices
        .iter()
        .find(|voice| voice.name == wanted)
        .or_else(|| voices.iter().find(|voice| voice.language.eq_ignore_ascii_case(language)))
        .or_else(|| voices.iter().find(|voice| base(&voice.language) == base(language)))
        .map(|voice| voice.name.clone())
}

fn rate_of(rate: f64) -> i32 {
    (rate.ln() / RATE_SPAN.ln() * RATE_LIMIT).round().clamp(-RATE_LIMIT, RATE_LIMIT) as i32
}

#[tauri::command]
pub async fn speech_voices<R: Runtime>(app: AppHandle<R>, speech: State<'_, Speech>) -> Result<Vec<SpeechVoice>, String> {
    let mut client = ready(&speech, &app).await?;
    let voices = listed(&speech, &mut client).await?;
    Ok(voices
        .into_iter()
        .map(|voice| SpeechVoice { id: voice.name.clone(), label: voice.name, language: voice.language })
        .collect())
}

#[tauri::command]
pub async fn speech_speak<R: Runtime>(
    app: AppHandle<R>,
    speech: State<'_, Speech>,
    key: String,
    chunks: Vec<String>,
    language: String,
    voice: String,
    rate: f64,
) -> Result<(), String> {
    let mut client = ready(&speech, &app).await?;
    let voices = listed(&speech, &mut client).await?;
    let chosen = pick(&voices, &voice, &language);
    let Some(connected) = client.as_mut() else {
        return Ok(());
    };
    let queued = connected
        .speak(&chunks.join(LINE_BREAK), &language.to_ascii_lowercase(), chosen.as_deref(), rate_of(rate))
        .await;
    let id = kept(&mut client, queued)?;
    if let Ok(mut current) = speech.current.lock() {
        *current = Some((key, id));
    }
    Ok(())
}

#[tauri::command]
pub async fn speech_stop(speech: State<'_, Speech>) -> Result<(), String> {
    if let Ok(mut current) = speech.current.lock() {
        current.take();
    }
    let mut client = speech.client.lock().await;
    let Some(connected) = client.as_mut() else {
        return Ok(());
    };
    let cancelled = connected.cancel().await;
    kept(&mut client, cancelled)
}
