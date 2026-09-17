use std::collections::{HashMap, VecDeque};
use std::io::{BufRead, BufReader, Read, Write};
#[cfg(windows)]
use std::os::windows::process::CommandExt;
use std::net::{SocketAddr, TcpStream};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex, OnceLock};
use std::time::Duration;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager, State};

const PROBE_TIMEOUT_MS: u64 = 400;
const HEALTH_TIMEOUT_MS: u64 = 2500;
const READY_ATTEMPTS: u32 = 60;
const STOP_ATTEMPTS: u32 = 20;
const READY_DELAY_MS: u64 = 500;
#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;
const TAIL_LINES: usize = 20;
const TAIL_REPORTED: usize = 12;
const STATUS_EVENT: &str = "local-server://status";
const DEFAULT_PORT: u16 = 8723;
const RUNTIME_FILE: &str = "data/state/.runtime";
const STATE_RUNTIME: &str = "state/.runtime";
const NATIVE_SOURCE: &str = "native";
const COMMAND_NAME: &str = if cfg!(windows) { "cconnect.exe" } else { "cconnect" };
const ENV_FILE: &str = ".env";
const PORT_KEY: &str = "PORT";
const PID_KEY: &str = "PID";
const TOKEN_KEY: &str = "PUBLIC_ACCESS_TOKEN";
const SECURITY_KEY_KEY: &str = "SECURITY_KEY";
const HEALTH_PATH: &str = "/api/health";
const STOP_PATH: &str = "/api/system/stop";
const RESTART_PATH: &str = "/api/system/restart";

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalServerConfig {
    pub dir: String,
    pub source: String,
    pub command_path: String,
    pub python: String,
    pub python_path: String,
    pub mode: String,
    pub public_host: String,
}

#[derive(Debug, Clone, Deserialize)]
struct NativeStatus {
    data: String,
    env: String,
}

static NATIVE_STATUS: OnceLock<Mutex<HashMap<PathBuf, NativeStatus>>> = OnceLock::new();

#[derive(Debug, Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalServerInfo {
    pub managed: bool,
    pub ready: bool,
    pub port: u16,
    pub error: Option<String>,
    pub error_detail: Option<String>,
    pub public_url: Option<String>,
    pub token: Option<String>,
    pub security_key: Option<String>,
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
    starting: bool,
}

fn emit(app: &AppHandle, info: &LocalServerInfo) {
    let _ = app.emit(STATUS_EVENT, info.clone());
}

fn port_open(port: u16) -> bool {
    let address = SocketAddr::from(([127, 0, 0, 1], port));
    TcpStream::connect_timeout(&address, Duration::from_millis(PROBE_TIMEOUT_MS)).is_ok()
}

fn wait_port(port: u16, open: bool, attempts: u32) -> bool {
    for _ in 0..attempts {
        if port_open(port) == open {
            return true;
        }
        std::thread::sleep(Duration::from_millis(READY_DELAY_MS));
    }
    port_open(port) == open
}

fn read_pairs(path: &Path) -> HashMap<String, String> {
    let mut pairs = HashMap::new();
    let Ok(text) = std::fs::read_to_string(path) else {
        return pairs;
    };
    for line in text.lines() {
        let line = line.trim();
        if line.is_empty() || line.starts_with('#') {
            continue;
        }
        if let Some((key, value)) = line.split_once('=') {
            pairs.insert(key.trim().to_string(), value.trim().trim_matches('"').to_string());
        }
    }
    pairs
}

fn native(config: &LocalServerConfig) -> bool {
    config.source == NATIVE_SOURCE
}

fn home_dir() -> Option<PathBuf> {
    std::env::var_os(if cfg!(windows) { "USERPROFILE" } else { "HOME" }).map(PathBuf::from)
}

fn installed_command() -> Option<PathBuf> {
    let path = home_dir()?.join(".local").join("bin").join(COMMAND_NAME);
    path.is_file().then_some(path)
}

fn resolve_command(config: &LocalServerConfig) -> Option<PathBuf> {
    let chosen = config.command_path.trim();
    if !chosen.is_empty() {
        let path = PathBuf::from(chosen);
        return path.is_file().then_some(path);
    }
    Some(installed_command().unwrap_or_else(|| PathBuf::from(COMMAND_NAME)))
}

fn native_status(command: &Path) -> Option<NativeStatus> {
    let cache = NATIVE_STATUS.get_or_init(|| Mutex::new(HashMap::new()));
    if let Some(known) = cache.lock().unwrap().get(command) {
        return Some(known.clone());
    }
    let mut probe = Command::new(command);
    probe.arg("status").arg("--json").stdin(Stdio::null());
    #[cfg(windows)]
    probe.creation_flags(CREATE_NO_WINDOW);
    let output = probe.output().ok()?;
    let printed = String::from_utf8_lossy(&output.stdout);
    let line = printed.lines().rev().find(|line| line.trim_start().starts_with('{'))?;
    let status: NativeStatus = serde_json::from_str(line).ok()?;
    cache.lock().unwrap().insert(command.to_path_buf(), status.clone());
    Some(status)
}

fn data_paths(config: &LocalServerConfig) -> Option<(PathBuf, PathBuf)> {
    if native(config) {
        let status = native_status(&resolve_command(config)?)?;
        let data = PathBuf::from(status.data);
        return Some((data.join(STATE_RUNTIME), PathBuf::from(status.env)));
    }
    let dir = PathBuf::from(&config.dir);
    Some((dir.join(RUNTIME_FILE), dir.join(ENV_FILE)))
}

fn resolve_port(config: &LocalServerConfig) -> u16 {
    let Some((runtime, environment)) = data_paths(config) else {
        return DEFAULT_PORT;
    };
    let port_in = |path: &Path| {
        read_pairs(path)
            .get(PORT_KEY)
            .and_then(|value| value.parse().ok())
    };
    port_in(&runtime).or_else(|| port_in(&environment)).unwrap_or(DEFAULT_PORT)
}

fn env_secret(config: &LocalServerConfig, key: &str) -> Option<String> {
    let (_, environment) = data_paths(config)?;
    read_pairs(&environment)
        .get(key)
        .map(|value| value.to_string())
        .filter(|value| !value.is_empty())
}

fn access_token(config: &LocalServerConfig) -> Option<String> {
    env_secret(config, TOKEN_KEY)
}

fn expects_gate(config: &LocalServerConfig) -> bool {
    config.mode != "local"
}

fn matching_exposure(config: &LocalServerConfig, port: u16) -> Option<(bool, Option<String>)> {
    running_exposure(port).filter(|(gated, _)| *gated == expects_gate(config))
}

fn wait_ready(config: &LocalServerConfig, port: u16, attempts: u32) -> Option<(bool, Option<String>)> {
    for _ in 0..attempts {
        if let Some(exposure) = matching_exposure(config, port) {
            return Some(exposure);
        }
        std::thread::sleep(Duration::from_millis(READY_DELAY_MS));
    }
    matching_exposure(config, port)
}

fn sync_credentials(
    config: &LocalServerConfig,
    info: &mut LocalServerInfo,
    exposure: Option<(bool, Option<String>)>,
) {
    let Some((gated, public_url)) = exposure else {
        info.public_url = None;
        info.token = None;
        info.security_key = None;
        return;
    };
    info.public_url = public_url.or_else(|| info.public_url.take());
    if !gated {
        info.token = None;
        info.security_key = None;
        return;
    }
    if info.token.is_none() {
        info.token = env_secret(config, TOKEN_KEY);
    }
    if info.security_key.is_none() {
        info.security_key = env_secret(config, SECURITY_KEY_KEY);
    }
}

fn running_exposure(port: u16) -> Option<(bool, Option<String>)> {
    let body = get(port, HEALTH_PATH)?;
    let exposure = serde_json::from_str::<serde_json::Value>(&body)
        .ok()?
        .get("data")?
        .get("exposure")?
        .clone();
    let gated = exposure.get("gated")?.as_bool()?;
    let public_url = exposure
        .get("public_url")
        .and_then(|value| value.as_str())
        .map(|value| value.trim_end_matches('/').to_string());
    Some((gated, public_url))
}

fn get(port: u16, path: &str) -> Option<String> {
    let address = SocketAddr::from(([127, 0, 0, 1], port));
    let timeout = Duration::from_millis(HEALTH_TIMEOUT_MS);
    let mut stream = TcpStream::connect_timeout(&address, timeout).ok()?;
    let _ = stream.set_write_timeout(Some(timeout));
    let _ = stream.set_read_timeout(Some(timeout));
    let request = format!(
        "GET {path} HTTP/1.1\r\nHost: 127.0.0.1:{port}\r\nAccept: application/json\r\nConnection: close\r\n\r\n"
    );
    stream.write_all(request.as_bytes()).ok()?;
    let mut response = String::new();
    BufReader::new(stream).read_to_string(&mut response).ok()?;
    let (head, body) = response.split_once("\r\n\r\n")?;
    head.lines().next()?.contains(" 200").then(|| body.to_string())
}

fn recorded_pid(config: &LocalServerConfig) -> Option<u32> {
    let (runtime, _) = data_paths(config)?;
    read_pairs(&runtime)
        .get(PID_KEY)
        .and_then(|value| value.parse().ok())
}

fn post(port: u16, path: &str, token: Option<&str>) -> bool {
    let address = SocketAddr::from(([127, 0, 0, 1], port));
    let timeout = Duration::from_millis(PROBE_TIMEOUT_MS);
    let Ok(mut stream) = TcpStream::connect_timeout(&address, timeout) else {
        return false;
    };
    let _ = stream.set_write_timeout(Some(timeout));
    let _ = stream.set_read_timeout(Some(timeout));
    let auth = token
        .map(|value| format!("Authorization: Bearer {value}\r\n"))
        .unwrap_or_default();
    let request = format!(
        "POST {path} HTTP/1.1\r\nHost: 127.0.0.1:{port}\r\nContent-Length: 0\r\nConnection: close\r\n{auth}\r\n"
    );
    if stream.write_all(request.as_bytes()).is_err() {
        return false;
    }
    let mut status = String::new();
    BufReader::new(stream).read_line(&mut status).is_ok() && status.contains(" 200")
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
        if let Some(token) = secret_in(line) {
            info.token = Some(token);
        }
    }
    if line.contains("Security key") {
        if let Some(key) = secret_in(line) {
            info.security_key = Some(key);
        }
    }
}

fn secret_in(line: &str) -> Option<String> {
    let value = line
        .split_once(':')
        .map(|(_, rest)| rest.split("[Auto]").next().unwrap_or(rest).trim())
        .unwrap_or_default();
    (!value.is_empty()).then(|| value.to_string())
}

#[tauri::command(async)]
pub fn local_server_status(
    state: State<'_, LocalServerState>,
    config: LocalServerConfig,
) -> LocalServerInfo {
    let managed = {
        let mut inner = state.inner.lock().unwrap();
        if let Some(child) = inner.child.as_mut() {
            if matches!(child.try_wait(), Ok(Some(_))) {
                inner.child = None;
            }
        }
        inner.child.is_some()
    };
    let port = resolve_port(&config);
    let open = port_open(port);
    {
        let mut inner = state.inner.lock().unwrap();
        if open && inner.info.ready && inner.info.port == port {
            inner.info.managed = managed;
            return inner.info.clone();
        }
    }
    let exposure = open.then(|| running_exposure(port)).flatten();
    let usable = exposure.as_ref().map(|(gated, _)| *gated == expects_gate(&config));
    let ready = usable == Some(true);
    let mut inner = state.inner.lock().unwrap();
    inner.info.managed = managed;
    inner.info.ready = ready;
    inner.info.port = port;
    if ready {
        inner.info.error = None;
        inner.info.error_detail = None;
    } else if usable == Some(false) {
        inner.info.error = Some("mode_mismatch".into());
    } else if open && !managed {
        inner.info.error = Some("port_busy".into());
    }
    sync_credentials(&config, &mut inner.info, exposure.filter(|_| ready));
    inner.info.clone()
}

fn start_inner(
    app: &AppHandle,
    state: &LocalServerState,
    config: &LocalServerConfig,
) -> Result<LocalServerInfo, String> {
    {
        let mut inner = state.inner.lock().unwrap();
        if inner.child.is_some() || inner.starting {
            return Ok(inner.info.clone());
        }
        inner.starting = true;
    }
    let _guard = StartGuard { state };

    let dir = PathBuf::from(&config.dir);
    let port = resolve_port(config);
    let mut info = LocalServerInfo {
        port,
        ..LocalServerInfo::default()
    };
    if !native(config) && (config.dir.trim().is_empty() || !dir.is_dir()) {
        info.error = Some("bad_dir".into());
        state.inner.lock().unwrap().info = info.clone();
        emit(app, &info);
        return Ok(info);
    }

    if port_open(port) {
        match running_exposure(port) {
            Some(exposure) if exposure.0 == expects_gate(config) => {
                info.ready = true;
                sync_credentials(config, &mut info, Some(exposure));
            }
            Some(_) => info.error = Some("mode_mismatch".into()),
            None => info.error = Some("port_busy".into()),
        }
        state.inner.lock().unwrap().info = info.clone();
        emit(app, &info);
        return Ok(info);
    }

    let launcher = if native(config) {
        resolve_command(config).filter(|command| native_status(command).is_some())
    } else {
        resolve_python(config, &dir)
    };
    let Some(launcher) = launcher else {
        info.error = Some(if native(config) { "no_command" } else { "no_python" }.into());
        state.inner.lock().unwrap().info = info.clone();
        emit(app, &info);
        return Ok(info);
    };

    let mut command = Command::new(launcher);
    if !native(config) {
        command.arg("run.py").current_dir(&dir);
    }
    command
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
            emit(app, &info);
            return Ok(info);
        }
    };

    let stdout = child.stdout.take();
    let stderr = child.stderr.take();
    info.managed = true;
    let generation = {
        let mut inner = state.inner.lock().unwrap();
        inner.generation += 1;
        inner.info = info.clone();
        inner.child = Some(child);
        inner.generation
    };
    emit(app, &info);

    let ready_app = app.clone();
    let ready_config = config.clone();
    std::thread::spawn(move || {
        let Some(exposure) = wait_ready(&ready_config, port, READY_ATTEMPTS) else {
            return;
        };
        let state = ready_app.state::<LocalServerState>();
        let mut inner = state.inner.lock().unwrap();
        if inner.generation != generation {
            return;
        }
        inner.info.managed = true;
        inner.info.ready = true;
        inner.info.port = port;
        sync_credentials(&ready_config, &mut inner.info, Some(exposure));
        let info = inner.info.clone();
        drop(inner);
        let _ = ready_app.emit(STATUS_EVENT, info);
    });

    let tail: Arc<Mutex<VecDeque<String>>> = Arc::new(Mutex::new(VecDeque::new()));
    let errors = stderr.map(|stderr| {
        let tail = Arc::clone(&tail);
        std::thread::spawn(move || {
            for line in BufReader::new(stderr).lines().map_while(Result::ok) {
                push_tail(&tail, line);
            }
        })
    });

    if let Some(stdout) = stdout {
        let reader_app = app.clone();
        std::thread::spawn(move || {
            let mut current = LocalServerInfo {
                managed: true,
                ..LocalServerInfo::default()
            };
            for line in BufReader::new(stdout).lines().map_while(Result::ok) {
                push_tail(&tail, line.clone());
                let before = (
                    current.public_url.clone(),
                    current.token.clone(),
                    current.security_key.clone(),
                );
                parse_line(&line, &mut current);
                let after = (
                    current.public_url.clone(),
                    current.token.clone(),
                    current.security_key.clone(),
                );
                if before != after {
                    emit(&reader_app, &current);
                }
            }
            if let Some(errors) = errors {
                let _ = errors.join();
            }
            let lines = tail.lock().unwrap();
            let detail: Vec<String> = lines.iter().rev().take(TAIL_REPORTED).rev().cloned().collect();
            drop(lines);
            let crashed = LocalServerInfo {
                managed: false,
                ready: false,
                port,
                error: Some("crashed".into()),
                error_detail: Some(detail.join("\n")).filter(|text| !text.trim().is_empty()),
                ..LocalServerInfo::default()
            };
            let state = reader_app.state::<LocalServerState>();
            let mut inner = state.inner.lock().unwrap();
            if inner.generation != generation {
                return;
            }
            inner.child = None;
            inner.info = crashed.clone();
            drop(inner);
            let _ = reader_app.emit(STATUS_EVENT, crashed);
        });
    }

    Ok(info)
}

struct StartGuard<'a> {
    state: &'a LocalServerState,
}

impl Drop for StartGuard<'_> {
    fn drop(&mut self) {
        if let Ok(mut inner) = self.state.inner.lock() {
            inner.starting = false;
        }
    }
}

fn push_tail(tail: &Arc<Mutex<VecDeque<String>>>, line: String) {
    let Ok(mut lines) = tail.lock() else {
        return;
    };
    lines.push_back(line);
    while lines.len() > TAIL_LINES {
        lines.pop_front();
    }
}

fn kill_pid(pid: u32) {
    #[cfg(windows)]
    {
        let _ = Command::new("taskkill")
            .args(["/PID", &pid.to_string(), "/T", "/F"])
            .creation_flags(CREATE_NO_WINDOW)
            .status();
    }
    #[cfg(not(windows))]
    {
        let _ = Command::new("pkill").args(["-TERM", "-P", &pid.to_string()]).status();
        let _ = Command::new("kill").args(["-TERM", &pid.to_string()]).status();
    }
}

fn kill_tree(child: &mut Child) {
    kill_pid(child.id());
    let _ = child.kill();
    let _ = child.wait();
}

pub fn shutdown(state: &LocalServerState) {
    let mut inner = state.inner.lock().unwrap();
    let port = inner.info.port;
    if let Some(mut child) = inner.child.take() {
        kill_tree(&mut child);
    }
    inner.info = LocalServerInfo::default();
    drop(inner);
    if port != 0 {
        wait_port(port, false, STOP_ATTEMPTS);
    }
}

fn stop_inner(app: &AppHandle, state: &LocalServerState, config: &LocalServerConfig) -> LocalServerInfo {
    let port = resolve_port(config);
    let child = state.inner.lock().unwrap().child.take();
    match child {
        Some(mut child) => kill_tree(&mut child),
        None => {
            if !post(port, STOP_PATH, access_token(config).as_deref()) {
                if let Some(pid) = recorded_pid(config) {
                    kill_pid(pid);
                }
            }
        }
    }
    wait_port(port, false, STOP_ATTEMPTS);
    let mut inner = state.inner.lock().unwrap();
    inner.info = LocalServerInfo {
        port,
        ..LocalServerInfo::default()
    };
    let info = inner.info.clone();
    drop(inner);
    emit(app, &info);
    info
}

#[tauri::command(async)]
pub fn local_server_start(
    app: AppHandle,
    state: State<'_, LocalServerState>,
    config: LocalServerConfig,
) -> Result<LocalServerInfo, String> {
    start_inner(&app, &state, &config)
}

#[tauri::command(async)]
pub fn local_server_stop(
    app: AppHandle,
    state: State<'_, LocalServerState>,
    config: LocalServerConfig,
) -> LocalServerInfo {
    stop_inner(&app, &state, &config)
}

#[tauri::command(async)]
pub fn local_server_update(
    app: AppHandle,
    state: State<'_, LocalServerState>,
    config: LocalServerConfig,
) -> Result<String, String> {
    if !native(&config) {
        return Err("not_native".into());
    }
    let command = resolve_command(&config).ok_or("no_command")?;
    let managed = state.inner.lock().unwrap().child.is_some();
    if managed {
        stop_inner(&app, &state, &config);
    }
    let mut upgrade = Command::new(&command);
    upgrade.arg("update").stdin(Stdio::null());
    #[cfg(windows)]
    upgrade.creation_flags(CREATE_NO_WINDOW);
    let output = upgrade.output().map_err(|_| "launch_failed".to_string())?;
    NATIVE_STATUS.get_or_init(|| Mutex::new(HashMap::new())).lock().unwrap().remove(&command);
    let printed = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let failed = String::from_utf8_lossy(&output.stderr).trim().to_string();
    if managed {
        start_inner(&app, &state, &config)?;
    }
    if output.status.success() {
        Ok(printed)
    } else {
        Err(if failed.is_empty() { printed } else { failed })
    }
}

#[tauri::command(async)]
pub fn local_server_restart(
    app: AppHandle,
    state: State<'_, LocalServerState>,
    config: LocalServerConfig,
) -> Result<LocalServerInfo, String> {
    if state.inner.lock().unwrap().child.is_some() {
        stop_inner(&app, &state, &config);
        return start_inner(&app, &state, &config);
    }
    let port = resolve_port(&config);
    if !post(port, RESTART_PATH, access_token(&config).as_deref()) {
        return Ok(state.inner.lock().unwrap().info.clone());
    }
    wait_port(port, false, STOP_ATTEMPTS);
    let exposure = wait_ready(&config, port, READY_ATTEMPTS);
    let mut inner = state.inner.lock().unwrap();
    inner.info = LocalServerInfo {
        ready: exposure.is_some(),
        port,
        ..LocalServerInfo::default()
    };
    sync_credentials(&config, &mut inner.info, exposure);
    let info = inner.info.clone();
    drop(inner);
    emit(&app, &info);
    Ok(info)
}
