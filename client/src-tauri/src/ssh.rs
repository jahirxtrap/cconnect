use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;

use base64::Engine;
use russh::client::{self, Config, Handle, Handler};
use russh::keys::ssh_key::{HashAlg, PublicKey};
use russh::keys::known_hosts::{known_host_keys_path, learn_known_hosts_path};
use russh::{ChannelMsg, Disconnect};
use serde::Deserialize;
use tauri::{AppHandle, Emitter, Manager, State};
use tokio::sync::mpsc::{unbounded_channel, UnboundedSender};
use tokio::sync::Mutex;

const TERM: &str = "xterm-256color";
const KEEPALIVE_SECS: u64 = 15;
const KNOWN_HOSTS: &str = "known_hosts";
const DEFAULT_PORT: u16 = 22;
const KEY_CHANGED: &str = "hostkey_changed:";
const PROBE_COMMAND: &str =
    "sh -c 'uname -s 2>/dev/null; cat /etc/os-release /etc/lsb-release /etc/system-release 2>/dev/null'";

async fn probe_os(handle: &Handle<Client>) -> Option<String> {
    let mut channel = handle.channel_open_session().await.ok()?;
    channel.exec(true, PROBE_COMMAND).await.ok()?;
    let mut raw = Vec::new();
    while let Some(message) = channel.wait().await {
        match message {
            ChannelMsg::Data { ref data } => raw.extend_from_slice(data),
            ChannelMsg::Eof | ChannelMsg::Close => break,
            _ => {}
        }
    }
    let text = String::from_utf8_lossy(&raw).to_string();
    if text.trim().is_empty() {
        return Some("windows".into());
    }
    let upper = text.to_uppercase();
    if upper.contains("DARWIN") {
        return Some("macos".into());
    }
    if upper.contains("MINGW") || upper.contains("MSYS") || upper.contains("CYGWIN") {
        return Some("windows".into());
    }
    for line in text.lines() {
        let trimmed = line.trim();
        for prefix in ["ID=", "DISTRIB_ID="] {
            if let Some(value) = trimmed.strip_prefix(prefix) {
                let name = value.trim_matches('"').trim();
                if !name.is_empty() {
                    return Some(name.to_lowercase());
                }
            }
        }
    }
    upper.contains("LINUX").then(|| "linux".to_string())
}

#[derive(Debug, Deserialize)]
pub struct SshProfile {
    pub host: String,
    pub port: u16,
    pub user: String,
    pub password: String,
}

enum Command {
    Data(Vec<u8>),
    Resize(u32, u32),
}

struct Session {
    handle: Handle<Client>,
    outgoing: UnboundedSender<Command>,
}

#[derive(Default)]
pub struct SshState {
    sessions: Mutex<HashMap<String, Session>>,
}

struct Client {
    known_hosts: PathBuf,
    host: String,
    port: u16,
    changed: Arc<std::sync::Mutex<Option<String>>>,
}

impl Handler for Client {
    type Error = russh::Error;

    async fn check_server_key(&mut self, key: &PublicKey) -> Result<bool, Self::Error> {
        let recorded = known_host_keys_path(&self.host, self.port, &self.known_hosts).unwrap_or_default();
        if recorded.iter().any(|(_, known)| known == key) {
            return Ok(true);
        }
        if recorded.is_empty() {
            let _ = learn_known_hosts_path(&self.host, self.port, key, &self.known_hosts);
            return Ok(true);
        }
        *self.changed.lock().unwrap() = Some(key.fingerprint(HashAlg::Sha256).to_string());
        Ok(false)
    }
}

fn known_hosts_file(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|directory| directory.join(KNOWN_HOSTS))
        .map_err(|error| error.to_string())
}

fn host_entry(host: &str, port: u16) -> String {
    if port == DEFAULT_PORT {
        host.to_string()
    } else {
        format!("[{host}]:{port}")
    }
}

#[tauri::command]
pub fn ssh_forget_host(app: AppHandle, host: String, port: u16) -> Result<(), String> {
    let path = known_hosts_file(&app)?;
    let Ok(listed) = std::fs::read_to_string(&path) else {
        return Ok(());
    };
    let entry = host_entry(&host, port);
    let kept: String = listed
        .lines()
        .filter(|line| {
            !line
                .split(' ')
                .next()
                .is_some_and(|hosts| hosts.split(',').any(|name| name == entry))
        })
        .map(|line| format!("{line}\n"))
        .collect();
    std::fs::write(&path, kept).map_err(|error| error.to_string())
}

fn data_event(id: &str) -> String {
    format!("ssh://data/{id}")
}

fn closed_event(id: &str) -> String {
    format!("ssh://closed/{id}")
}

#[tauri::command]
pub async fn ssh_connect(
    app: AppHandle,
    state: State<'_, SshState>,
    id: String,
    profile: SshProfile,
    cols: u32,
    rows: u32,
) -> Result<Option<String>, String> {
    let config = Arc::new(Config {
        keepalive_interval: Some(std::time::Duration::from_secs(KEEPALIVE_SECS)),
        ..Config::default()
    });
    let changed = Arc::new(std::sync::Mutex::new(None));
    let client = Client {
        known_hosts: known_hosts_file(&app)?,
        host: profile.host.clone(),
        port: profile.port,
        changed: changed.clone(),
    };
    let mut handle = client::connect(config, (profile.host.as_str(), profile.port), client)
        .await
        .map_err(|error| match changed.lock().unwrap().take() {
            Some(fingerprint) => format!("{KEY_CHANGED}{fingerprint}"),
            None => error.to_string(),
        })?;

    let authenticated = handle
        .authenticate_password(&profile.user, &profile.password)
        .await
        .map_err(|error| error.to_string())?;
    if !authenticated.success() {
        return Err("auth".into());
    }

    let detected_os = probe_os(&handle).await;

    let mut channel = handle
        .channel_open_session()
        .await
        .map_err(|error| error.to_string())?;
    channel
        .request_pty(false, TERM, cols, rows, 0, 0, &[])
        .await
        .map_err(|error| error.to_string())?;
    channel
        .request_shell(true)
        .await
        .map_err(|error| error.to_string())?;

    let (outgoing, mut commands) = unbounded_channel::<Command>();
    let session_id = id.clone();

    tauri::async_runtime::spawn(async move {
        let encoder = base64::engine::general_purpose::STANDARD;
        loop {
            tokio::select! {
                message = channel.wait() => match message {
                    Some(ChannelMsg::Data { ref data })
                    | Some(ChannelMsg::ExtendedData { ref data, .. }) => {
                        let _ = app.emit(&data_event(&session_id), encoder.encode(&data[..]));
                    }
                    Some(ChannelMsg::Eof) | Some(ChannelMsg::Close) | None => break,
                    Some(_) => {}
                },
                command = commands.recv() => match command {
                    Some(Command::Data(bytes)) => {
                        if channel.data(bytes.as_slice()).await.is_err() {
                            break;
                        }
                    }
                    Some(Command::Resize(cols, rows)) => {
                        let _ = channel.window_change(cols, rows, 0, 0).await;
                    }
                    None => break,
                },
            }
        }
        let _ = app.emit(&closed_event(&session_id), ());
    });

    state
        .sessions
        .lock()
        .await
        .insert(id, Session { handle, outgoing });
    Ok(detected_os)
}

#[tauri::command]
pub async fn ssh_send(state: State<'_, SshState>, id: String, data: Vec<u8>) -> Result<(), String> {
    let sessions = state.sessions.lock().await;
    let session = sessions.get(&id).ok_or("unknown session")?;
    session
        .outgoing
        .send(Command::Data(data))
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn ssh_resize(
    state: State<'_, SshState>,
    id: String,
    cols: u32,
    rows: u32,
) -> Result<(), String> {
    let sessions = state.sessions.lock().await;
    let session = sessions.get(&id).ok_or("unknown session")?;
    session
        .outgoing
        .send(Command::Resize(cols, rows))
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn ssh_close(state: State<'_, SshState>, id: String) -> Result<(), String> {
    if let Some(session) = state.sessions.lock().await.remove(&id) {
        let _ = session
            .handle
            .disconnect(Disconnect::ByApplication, "", "")
            .await;
    }
    Ok(())
}
