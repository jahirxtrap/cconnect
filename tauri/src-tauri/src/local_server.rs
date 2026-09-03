use std::collections::VecDeque;
use std::io::{BufRead, BufReader};
#[cfg(windows)]
use std::os::windows::process::CommandExt;
use std::net::{SocketAddr, TcpStream};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::time::Duration;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, State};

const PROBE_TIMEOUT_MS: u64 = 400;
const READY_ATTEMPTS: u32 = 60;
const READY_DELAY_MS: u64 = 500;
#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;
const TAIL_LINES: usize = 20;
const TAIL_REPORTED: usize = 12;
const STATUS_EVENT: &str = "local-server://status";

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalServerConfig {
    pub dir: String,
    pub python: String,
    pub python_path: String,
    pub mode: String,
    pub probe_port: u16,
    pub public_host: String,
}

#[derive(Debug, Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalServerInfo {
    pub managed: bool,
    pub ready: bool,
    pub error: Option<String>,
    pub error_detail: Option<String>,
    pub public_url: Option<String>,
    pub token: Option<String>,
}

#[derive(Default)]
pub struct LocalServerState {
    inner: Mutex<Inner>,
}

#[derive(Default)]
struct Inner {
    child: Option<Child>,
    info: LocalServerInfo,
    generation: u64,
}

fn emit(app: &AppHandle, info: &LocalServerInfo) {
    let _ = app.emit(STATUS_EVENT, info.clone());
}

fn port_open(port: u16) -> bool {
    let address = SocketAddr::from(([127, 0, 0, 1], port));
    TcpStream::connect_timeout(&address, Duration::from_millis(PROBE_TIMEOUT_MS)).is_ok()
}

fn venv_python(dir: &Path) -> Option<PathBuf> {
    let candidates = ["Scripts/python.exe", "bin/python", "bin/python3"];
    let entries = std::fs::read_dir(dir).ok()?;
    for entry in entries.flatten() {
        if !entry.file_type().ok()?.is_dir() {
            continue;
        }
        for candidate in candidates {
            let path = entry.path().join(candidate);
            if path.is_file() {
                return Some(path);
            }
        }
    }
    None
}

fn system_python() -> PathBuf {
    PathBuf::from(if cfg!(windows) { "python" } else { "python3" })
}

fn resolve_python(config: &LocalServerConfig, dir: &Path) -> Option<PathBuf> {
    match config.python.as_str() {
        "custom" => {
            let path = PathBuf::from(&config.python_path);
            path.is_file().then_some(path)
        }
        "auto" => Some(venv_python(dir).unwrap_or_else(system_python)),
        _ => Some(system_python()),
    }
}

fn parse_line(line: &str, info: &mut LocalServerInfo) {
    if line.contains("Public URL") {
        if let Some(start) = line.find("http") {
            let url = line[start..].split_whitespace().next().unwrap_or_default();
            if !url.is_empty() {
                info.public_url = Some(url.trim_end_matches('/').to_string());
            }
        }
    }
    if line.contains("Token") {
        let token = line
            .split_once(':')
            .map(|(_, rest)| rest.split("[Auto]").next().unwrap_or(rest).trim())
            .unwrap_or_default();
        if !token.is_empty() {
            info.token = Some(token.to_string());
        }
    }
}

#[tauri::command]
pub fn local_server_status(state: State<'_, LocalServerState>) -> LocalServerInfo {
    state.inner.lock().unwrap().info.clone()
}

#[tauri::command(async)]
pub fn local_server_start(
    app: AppHandle,
    state: State<'_, LocalServerState>,
    config: LocalServerConfig,
) -> Result<LocalServerInfo, String> {
    {
        let inner = state.inner.lock().unwrap();
        if inner.child.is_some() {
            return Ok(inner.info.clone());
        }
    }

    let dir = PathBuf::from(&config.dir);
    let mut info = LocalServerInfo::default();
    if config.dir.trim().is_empty() || !dir.is_dir() {
        info.error = Some("bad_dir".into());
        state.inner.lock().unwrap().info = info.clone();
        emit(&app, &info);
        return Ok(info);
    }

    if port_open(config.probe_port) {
        info.ready = true;
        state.inner.lock().unwrap().info = info.clone();
        emit(&app, &info);
        return Ok(info);
    }

    let Some(python) = resolve_python(&config, &dir) else {
        info.error = Some("no_python".into());
        state.inner.lock().unwrap().info = info.clone();
        emit(&app, &info);
        return Ok(info);
    };

    let mut command = Command::new(python);
    command
        .arg("run.py")
        .current_dir(&dir)
        .env("PYTHONUNBUFFERED", "1")
        .env("PYTHONIOENCODING", "utf-8")
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    #[cfg(windows)]
    command.creation_flags(CREATE_NO_WINDOW);
    if config.mode != "local" {
        command.arg("--expose").arg(&config.mode);
        if config.mode == "caddy" && !config.public_host.trim().is_empty() {
            command.arg("--public-host").arg(config.public_host.trim());
        }
    }

    let mut child = match command.spawn() {
        Ok(child) => child,
        Err(_) => {
            info.error = Some("launch_failed".into());
            state.inner.lock().unwrap().info = info.clone();
            emit(&app, &info);
            return Ok(info);
        }
    };

    let stdout = child.stdout.take();
    info.managed = true;
    let generation = {
        let mut inner = state.inner.lock().unwrap();
        inner.generation += 1;
        inner.info = info.clone();
        inner.child = Some(child);
        inner.generation
    };
    emit(&app, &info);

    let probe_port = config.probe_port;
    let ready_app = app.clone();
    std::thread::spawn(move || {
        for _ in 0..READY_ATTEMPTS {
            if port_open(probe_port) {
                let _ = ready_app.emit(
                    STATUS_EVENT,
                    LocalServerInfo {
                        managed: true,
                        ready: true,
                        ..LocalServerInfo::default()
                    },
                );
                return;
            }
            std::thread::sleep(Duration::from_millis(READY_DELAY_MS));
        }
    });

    if let Some(stdout) = stdout {
        let reader_app = app.clone();
        std::thread::spawn(move || {
            let mut tail: VecDeque<String> = VecDeque::new();
            let mut current = LocalServerInfo {
                managed: true,
                ..LocalServerInfo::default()
            };
            for line in BufReader::new(stdout).lines().map_while(Result::ok) {
                tail.push_back(line.clone());
                while tail.len() > TAIL_LINES {
                    tail.pop_front();
                }
                let before = (current.public_url.clone(), current.token.clone());
                parse_line(&line, &mut current);
                if before != (current.public_url.clone(), current.token.clone()) {
                    emit(&reader_app, &current);
                }
            }
            let detail: Vec<String> = tail.iter().rev().take(TAIL_REPORTED).rev().cloned().collect();
            let crashed = LocalServerInfo {
                managed: false,
                ready: false,
                error: Some("crashed".into()),
                error_detail: Some(detail.join("\n")).filter(|text| !text.trim().is_empty()),
                public_url: current.public_url.clone(),
                token: current.token.clone(),
            };
            let _ = reader_app.emit(STATUS_EVENT, crashed);
            let _ = generation;
        });
    }

    Ok(info)
}

fn kill_tree(child: &mut Child) {
    let pid = child.id();
    #[cfg(windows)]
    {
        let _ = Command::new("taskkill")
            .args(["/PID", &pid.to_string(), "/T", "/F"])
            .creation_flags(CREATE_NO_WINDOW)
            .spawn();
    }
    #[cfg(not(windows))]
    {
        let _ = Command::new("pkill").args(["-TERM", "-P", &pid.to_string()]).spawn();
    }
    let _ = child.kill();
}

pub fn shutdown(state: &LocalServerState) {
    let mut inner = state.inner.lock().unwrap();
    if let Some(mut child) = inner.child.take() {
        kill_tree(&mut child);
    }
    inner.info = LocalServerInfo::default();
}

#[tauri::command(async)]
pub fn local_server_stop(app: AppHandle, state: State<'_, LocalServerState>) -> LocalServerInfo {
    let mut inner = state.inner.lock().unwrap();
    if let Some(mut child) = inner.child.take() {
        kill_tree(&mut child);
    }
    inner.info = LocalServerInfo::default();
    let info = inner.info.clone();
    drop(inner);
    emit(&app, &info);
    info
}
