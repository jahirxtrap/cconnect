use std::collections::{HashMap, VecDeque};
use std::io::SeekFrom;
use std::path::PathBuf;
use std::sync::{Arc, Mutex, OnceLock};
use std::time::Duration;

use tauri::async_runtime::JoinHandle;
use tauri::{AppHandle, Manager, State};
use tauri_plugin_http::reqwest;
use tokio::fs::{File, OpenOptions};
use tokio::io::{AsyncReadExt, AsyncSeekExt, AsyncWrite, AsyncWriteExt};
use tokio::net::{TcpListener, TcpStream};
use tokio::time::{sleep, timeout};

const LOOPBACK: &str = "127.0.0.1";
const ACCEPT_RETRY: Duration = Duration::from_millis(50);
const HEAD_WAIT: Duration = Duration::from_secs(10);
const IDLE_LIMIT: usize = 256;
const HEAD_LIMIT: usize = 16 * 1024;
const READ_BUFFER: usize = 64 * 1024;
const HEAD_END: &[u8] = b"\r\n\r\n";
const STORE_FOLDER: &str = "media";
const FORWARDED: [&str; 4] = ["range", "if-range", "if-none-match", "if-modified-since"];
const PASSED: [&str; 6] = ["content-type", "content-length", "content-range", "accept-ranges", "etag", "last-modified"];
const KEPT: [&str; 4] = ["content-type", "accept-ranges", "etag", "last-modified"];
const COMMON: &str = "cache-control: no-cache\r\naccess-control-allow-origin: *\r\naccess-control-expose-headers: content-type, content-length, content-range, accept-ranges\r\nconnection: close\r\n";
const PREFLIGHT: &str = "access-control-allow-methods: GET, HEAD, OPTIONS\r\naccess-control-allow-headers: range\r\naccess-control-max-age: 600\r\n";

struct Meta {
    total: u64,
    head: String,
    etag: Option<String>,
    modified: Option<String>,
}

impl Meta {
    fn validators(&self) -> String {
        let etag = self.etag.as_ref().map(|etag| format!("etag: {etag}\r\n")).unwrap_or_default();
        let modified = self.modified.as_ref().map(|modified| format!("last-modified: {modified}\r\n")).unwrap_or_default();
        etag + &modified
    }

    fn unchanged_for(&self, forwarded: &[(String, String)]) -> bool {
        let bare = |tag: &str| tag.trim().trim_start_matches("W/").to_string();
        if let Some(tags) = value_of(forwarded, "if-none-match") {
            return self.etag.as_deref().is_some_and(|etag| tags.split(',').any(|tag| tag.trim() == "*" || bare(tag) == bare(etag)));
        }
        value_of(forwarded, "if-modified-since").is_some_and(|since| self.modified.as_deref() == Some(since))
    }

    fn holds(&self, condition: &str) -> bool {
        self.etag.as_deref() == Some(condition) || self.modified.as_deref() == Some(condition)
    }
}

#[derive(Default)]
struct Stored {
    generation: u64,
    meta: Option<Arc<Meta>>,
    ranges: Vec<(u64, u64)>,
}

struct Source {
    id: String,
    url: String,
    headers: HashMap<String, String>,
    folder: Option<PathBuf>,
    stored: Mutex<Stored>,
}

impl Source {
    fn generation(&self) -> u64 {
        self.stored.lock().map_or(0, |stored| stored.generation)
    }

    fn file_of(&self, generation: u64) -> Option<PathBuf> {
        self.folder.as_ref().map(|folder| folder.join(format!("{}-{generation}", self.id)))
    }

    fn meta(&self) -> Option<Arc<Meta>> {
        self.stored.lock().ok()?.meta.clone()
    }

    fn keep_meta(&self, meta: Meta) -> Arc<Meta> {
        let Ok(mut stored) = self.stored.lock() else {
            return Arc::new(meta);
        };
        stored.meta.get_or_insert_with(|| Arc::new(meta)).clone()
    }

    fn cached_until(&self, generation: u64, position: u64) -> Option<u64> {
        let stored = self.stored.lock().ok()?;
        if stored.generation != generation {
            return None;
        }
        stored.ranges.iter().find(|(start, end)| *start <= position && position < *end).map(|(_, end)| *end)
    }

    fn next_cached(&self, generation: u64, position: u64) -> Option<u64> {
        let stored = self.stored.lock().ok()?;
        if stored.generation != generation {
            return None;
        }
        stored.ranges.iter().map(|(start, _)| *start).filter(|start| *start > position).min()
    }

    fn mark(&self, generation: u64, start: u64, end: u64) {
        let Ok(mut stored) = self.stored.lock() else {
            return;
        };
        if stored.generation != generation {
            return;
        }
        stored.ranges.push((start, end));
        stored.ranges.sort_unstable();
        let mut merged: Vec<(u64, u64)> = Vec::with_capacity(stored.ranges.len());
        for (from, to) in stored.ranges.drain(..) {
            match merged.last_mut() {
                Some(last) if from <= last.1 => last.1 = last.1.max(to),
                _ => merged.push((from, to)),
            }
        }
        stored.ranges = merged;
    }

    fn forget(&self) {
        let Ok(mut stored) = self.stored.lock() else {
            return;
        };
        let generation = stored.generation;
        *stored = Stored { generation: generation + 1, ..Stored::default() };
        drop(stored);
        if let Some(file) = self.file_of(generation) {
            let _ = std::fs::remove_file(file);
        }
    }
}

struct Store {
    file: File,
    at: Option<u64>,
}

impl Store {
    async fn open(path: PathBuf) -> Option<Self> {
        let file = OpenOptions::new().read(true).write(true).create(true).truncate(false).open(path).await.ok()?;
        Some(Self { file, at: None })
    }

    async fn seek(&mut self, position: u64) -> std::io::Result<()> {
        if self.at != Some(position) {
            self.file.seek(SeekFrom::Start(position)).await?;
            self.at = Some(position);
        }
        Ok(())
    }

    async fn write(&mut self, position: u64, bytes: &[u8]) -> std::io::Result<()> {
        self.seek(position).await?;
        self.at = None;
        self.file.write_all(bytes).await?;
        self.file.flush().await?;
        self.at = Some(position + bytes.len() as u64);
        Ok(())
    }

    async fn copy(&mut self, socket: &mut (impl AsyncWrite + Unpin), from: u64, to: u64) -> std::io::Result<u64> {
        let mut copied = 0;
        if self.seek(from).await.is_err() {
            self.at = None;
            return Ok(0);
        }
        let mut buffer = vec![0u8; READ_BUFFER];
        while from + copied < to {
            let wanted = buffer.len().min((to - from - copied) as usize);
            let read = match self.file.read(&mut buffer[..wanted]).await {
                Ok(read) if read > 0 => read,
                _ => {
                    self.at = None;
                    break;
                }
            };
            socket.write_all(&buffer[..read]).await?;
            copied += read as u64;
            self.at = Some(from + copied);
        }
        Ok(copied)
    }
}

enum Wanted {
    Whole,
    From(u64, Option<u64>),
}

struct Served {
    src: String,
    task: JoinHandle<()>,
    leases: usize,
    source: Arc<Source>,
}

#[derive(Default)]
struct Servers {
    served: HashMap<String, Served>,
    leases: HashMap<String, String>,
    idle: VecDeque<String>,
}

pub struct Media {
    client: reqwest::Client,
    servers: Mutex<Servers>,
    folder: OnceLock<PathBuf>,
}

impl Default for Media {
    fn default() -> Self {
        Self {
            client: reqwest::Client::builder().http1_only().build().expect("media client"),
            servers: Mutex::default(),
            folder: OnceLock::new(),
        }
    }
}

pub fn prepare(app: &AppHandle) {
    let Ok(cache) = app.path().app_cache_dir() else {
        return;
    };
    let folder = cache.join(STORE_FOLDER);
    let _ = std::fs::remove_dir_all(&folder);
    if std::fs::create_dir_all(&folder).is_ok() {
        let _ = app.state::<Media>().folder.set(folder);
    }
}

fn key_of(url: &str, headers: &HashMap<String, String>) -> String {
    let mut pairs: Vec<String> = headers.iter().map(|(name, value)| format!("{name}: {value}")).collect();
    pairs.sort();
    format!("{url}\n{}", pairs.join("\n"))
}

fn reuse(servers: &mut Servers, key: &str, id: &str) -> Option<String> {
    let served = servers.served.get_mut(key)?;
    served.leases += 1;
    let src = served.src.clone();
    servers.idle.retain(|idle| idle != key);
    servers.leases.insert(id.to_string(), key.to_string());
    Some(src)
}

async fn listen(listener: TcpListener, source: Arc<Source>, client: reqwest::Client) {
    loop {
        let Ok((socket, _)) = listener.accept().await else {
            sleep(ACCEPT_RETRY).await;
            continue;
        };
        let (source, client) = (source.clone(), client.clone());
        tauri::async_runtime::spawn(async move {
            let _ = serve(socket, &source, &client).await;
        });
    }
}

async fn read_head(socket: &mut TcpStream) -> std::io::Result<String> {
    let mut head = Vec::new();
    let mut chunk = [0u8; 1024];
    while !head.windows(HEAD_END.len()).any(|window| window == HEAD_END) {
        let read = socket.read(&mut chunk).await?;
        if read == 0 || head.len() + read > HEAD_LIMIT {
            return Err(std::io::ErrorKind::InvalidData.into());
        }
        head.extend_from_slice(&chunk[..read]);
    }
    Ok(String::from_utf8_lossy(&head).into_owned())
}

async fn reply(socket: &mut (impl AsyncWrite + Unpin), status: &str, extra: &str) -> std::io::Result<()> {
    let head = format!("HTTP/1.1 {status}\r\ncontent-length: 0\r\n{COMMON}{extra}\r\n");
    socket.write_all(head.as_bytes()).await
}

fn stalled(_: tokio::time::error::Elapsed) -> std::io::Error {
    std::io::ErrorKind::TimedOut.into()
}

async fn serve(mut socket: TcpStream, source: &Source, client: &reqwest::Client) -> std::io::Result<()> {
    let head = timeout(HEAD_WAIT, read_head(&mut socket)).await.map_err(stalled)??;
    let mut lines = head.split("\r\n");
    let mut request = lines.next().unwrap_or_default().split(' ');
    let method = request.next().unwrap_or_default();
    let target = request.next().unwrap_or_default();
    let forwarded: Vec<(String, String)> = lines
        .filter_map(|line| line.split_once(':'))
        .map(|(name, value)| (name.trim().to_ascii_lowercase(), value.trim().to_string()))
        .filter(|(name, _)| FORWARDED.contains(&name.as_str()))
        .collect();
    if method == "OPTIONS" {
        return reply(&mut socket, "204 No Content", PREFLIGHT).await;
    }
    let id = target.trim_start_matches('/').split(['?', '#']).next().unwrap_or_default();
    if id != source.id {
        return reply(&mut socket, "404 Not Found", "").await;
    }
    let (mut reader, mut writer) = socket.split();
    let mut probe = [0u8; 1];
    tokio::select! {
        relayed = relay(&mut writer, method, &forwarded, source, client) => relayed,
        _ = reader.read(&mut probe) => Ok(()),
    }
}

fn value_of<'a>(forwarded: &'a [(String, String)], name: &str) -> Option<&'a str> {
    forwarded.iter().find(|(header, _)| header == name).map(|(_, value)| value.as_str())
}

fn wanted(forwarded: &[(String, String)]) -> Option<Wanted> {
    let Some(value) = value_of(forwarded, "range") else {
        return Some(Wanted::Whole);
    };
    let (start, end) = value.strip_prefix("bytes=")?.split_once('-')?;
    let end = if end.is_empty() { None } else { Some(end.parse().ok()?) };
    Some(Wanted::From(start.parse().ok()?, end))
}

fn upstream(client: &reqwest::Client, source: &Source, extra: &[(String, String)]) -> reqwest::RequestBuilder {
    let mut request = client.get(&source.url).header("accept-encoding", "identity");
    for (name, value) in source.headers.iter().chain(extra.iter().map(|(name, value)| (name, value))) {
        request = request.header(name, value);
    }
    request
}

fn header<'a>(response: &'a reqwest::Response, name: &str) -> Option<&'a str> {
    response.headers().get(name).and_then(|value| value.to_str().ok())
}

fn meta_of(response: &reqwest::Response) -> Option<Meta> {
    let total = match response.status().as_u16() {
        206 => header(response, "content-range")?.rsplit_once('/')?.1.parse().ok()?,
        200 => header(response, "content-length")?.parse().ok()?,
        _ => return None,
    };
    let head = KEPT.iter().filter_map(|name| header(response, name).map(|value| format!("{name}: {value}\r\n"))).collect();
    Some(Meta {
        total,
        head,
        etag: header(response, "etag").map(str::to_string),
        modified: header(response, "last-modified").map(str::to_string),
    })
}

fn begins_at(response: &reqwest::Response) -> Option<u64> {
    match response.status().as_u16() {
        206 => header(response, "content-range")?.strip_prefix("bytes ")?.split_once('-')?.0.parse().ok(),
        200 => Some(0),
        _ => None,
    }
}

async fn forward(socket: &mut (impl AsyncWrite + Unpin), method: &str, mut response: reqwest::Response) -> std::io::Result<()> {
    let status = response.status();
    let mut answer = format!("HTTP/1.1 {} {}\r\n", status.as_u16(), status.canonical_reason().unwrap_or_default());
    for name in PASSED {
        if let Some(value) = header(&response, name) {
            answer.push_str(&format!("{name}: {value}\r\n"));
        }
    }
    answer.push_str(COMMON);
    answer.push_str("\r\n");
    socket.write_all(answer.as_bytes()).await?;
    if method == "HEAD" {
        return Ok(());
    }
    while let Ok(Some(chunk)) = response.chunk().await {
        socket.write_all(&chunk).await?;
    }
    socket.shutdown().await
}

async fn relay(
    socket: &mut (impl AsyncWrite + Unpin),
    method: &str,
    forwarded: &[(String, String)],
    source: &Source,
    client: &reqwest::Client,
) -> std::io::Result<()> {
    let Some(mut wanted) = wanted(forwarded).filter(|_| method == "GET") else {
        let Ok(response) = upstream(client, source, forwarded).send().await else {
            return reply(socket, "502 Bad Gateway", "").await;
        };
        return forward(socket, method, response).await;
    };
    let generation = source.generation();
    let mut pending = None;
    let meta = match source.meta() {
        Some(meta) => {
            if meta.unchanged_for(forwarded) {
                let head = format!("HTTP/1.1 304 Not Modified\r\n{}{COMMON}\r\n", meta.validators());
                return socket.write_all(head.as_bytes()).await;
            }
            if value_of(forwarded, "if-range").is_some_and(|condition| !meta.holds(condition)) {
                wanted = Wanted::Whole;
            }
            meta
        }
        None => {
            let Ok(response) = upstream(client, source, forwarded).send().await else {
                return reply(socket, "502 Bad Gateway", "").await;
            };
            let asked = match wanted {
                Wanted::Whole => 0,
                Wanted::From(start, _) => start,
            };
            let Some(meta) = meta_of(&response).filter(|_| begins_at(&response) == Some(asked)) else {
                return forward(socket, method, response).await;
            };
            pending = Some(response);
            source.keep_meta(meta)
        }
    };
    let start = match wanted {
        Wanted::Whole => 0,
        Wanted::From(start, _) => start,
    };
    if meta.total == 0 {
        return reply(socket, "200 OK", &meta.head).await;
    }
    let last = match wanted {
        Wanted::From(_, Some(end)) => end.min(meta.total - 1),
        _ => meta.total - 1,
    };
    if start >= meta.total || last < start {
        return reply(socket, "416 Range Not Satisfiable", &format!("content-range: bytes */{}\r\n", meta.total)).await;
    }
    let (status, range) = match wanted {
        Wanted::Whole => ("200 OK", String::new()),
        Wanted::From(..) => ("206 Partial Content", format!("content-range: bytes {start}-{last}/{}\r\n", meta.total)),
    };
    let head = format!("HTTP/1.1 {status}\r\ncontent-length: {}\r\n{range}{}{COMMON}\r\n", last - start + 1, meta.head);
    socket.write_all(head.as_bytes()).await?;

    let mut store = match source.file_of(generation) {
        Some(path) => Store::open(path).await,
        None => None,
    };
    let end = last + 1;
    let mut position = start;
    while position < end {
        if let (Some(saved), Some(until)) = (store.as_mut(), source.cached_until(generation, position)) {
            let stop = until.min(end);
            position += saved.copy(&mut *socket, position, stop).await?;
            pending = None;
            if position < stop {
                store = None;
            }
            continue;
        }
        let mut response = match pending.take() {
            Some(response) => response,
            None => {
                let range = [("range".to_string(), format!("bytes={position}-"))];
                let response = upstream(client, source, &range).send().await.map_err(std::io::Error::other)?;
                if begins_at(&response) != Some(position) {
                    return Err(std::io::ErrorKind::InvalidData.into());
                }
                response
            }
        };
        let limit = if store.is_some() {
            source.next_cached(generation, position).map_or(end, |next| next.min(end))
        } else {
            end
        };
        while position < limit {
            let Some(chunk) = response.chunk().await.map_err(std::io::Error::other)? else {
                return Err(std::io::ErrorKind::UnexpectedEof.into());
            };
            let piece = &chunk[..chunk.len().min((limit - position) as usize)];
            if let Some(saved) = store.as_mut() {
                match saved.write(position, piece).await {
                    Ok(()) => source.mark(generation, position, position + piece.len() as u64),
                    Err(_) => store = None,
                }
            }
            socket.write_all(piece).await?;
            position += piece.len() as u64;
        }
    }
    socket.shutdown().await
}

#[tauri::command]
pub async fn media_open(
    media: State<'_, Media>,
    id: String,
    url: String,
    headers: HashMap<String, String>,
) -> Result<String, String> {
    let key = key_of(&url, &headers);
    let reused = {
        let mut servers = media.servers.lock().map_err(|error| error.to_string())?;
        reuse(&mut servers, &key, &id)
    };
    if let Some(src) = reused {
        return Ok(src);
    }
    let listener = TcpListener::bind((LOOPBACK, 0)).await.map_err(|error| error.to_string())?;
    let port = listener.local_addr().map_err(|error| error.to_string())?.port();
    let source = Arc::new(Source {
        id: id.clone(),
        url,
        headers,
        folder: media.folder.get().cloned(),
        stored: Mutex::default(),
    });
    let task = tauri::async_runtime::spawn(listen(listener, source.clone(), media.client.clone()));
    let mut servers = media.servers.lock().map_err(|error| error.to_string())?;
    if let Some(src) = reuse(&mut servers, &key, &id) {
        task.abort();
        return Ok(src);
    }
    let src = format!("http://{LOOPBACK}:{port}/{id}");
    servers.served.insert(key.clone(), Served { src: src.clone(), task, leases: 1, source });
    servers.leases.insert(id, key);
    Ok(src)
}

#[tauri::command]
pub fn media_close(media: State<'_, Media>, id: String) {
    let Ok(mut servers) = media.servers.lock() else {
        return;
    };
    let Some(key) = servers.leases.remove(&id) else {
        return;
    };
    let Some(served) = servers.served.get_mut(&key) else {
        return;
    };
    served.leases -= 1;
    if served.leases > 0 {
        return;
    }
    served.source.forget();
    servers.idle.push_back(key);
    while servers.idle.len() > IDLE_LIMIT {
        let Some(oldest) = servers.idle.pop_front() else {
            break;
        };
        if let Some(gone) = servers.served.remove(&oldest) {
            gone.task.abort();
        }
    }
}
