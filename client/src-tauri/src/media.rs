use std::collections::{HashMap, VecDeque};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use tauri::async_runtime::JoinHandle;
use tauri::State;
use tauri_plugin_http::reqwest;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::{TcpListener, TcpStream};
use tokio::time::{sleep, timeout};

const LOOPBACK: &str = "127.0.0.1";
const ACCEPT_RETRY: Duration = Duration::from_millis(50);
const HEAD_WAIT: Duration = Duration::from_secs(10);
const UPSTREAM_WAIT: Duration = Duration::from_secs(30);
const WRITE_WAIT: Duration = Duration::from_secs(60);
const IDLE_LIMIT: usize = 256;
const HEAD_LIMIT: usize = 16 * 1024;
const HEAD_END: &[u8] = b"\r\n\r\n";
const FORWARDED: [&str; 4] = ["range", "if-range", "if-none-match", "if-modified-since"];
const PASSED: [&str; 6] = ["content-type", "content-length", "content-range", "accept-ranges", "etag", "last-modified"];
const COMMON: &str = "cache-control: no-cache\r\naccess-control-allow-origin: *\r\naccess-control-expose-headers: content-type, content-length, content-range, accept-ranges\r\nconnection: close\r\n";
const PREFLIGHT: &str = "access-control-allow-methods: GET, HEAD, OPTIONS\r\naccess-control-allow-headers: range\r\naccess-control-max-age: 600\r\n";

struct Source {
    id: String,
    url: String,
    headers: HashMap<String, String>,
}

struct Served {
    src: String,
    task: JoinHandle<()>,
    leases: usize,
}

#[derive(Default)]
struct Servers {
    served: HashMap<String, Served>,
    leases: HashMap<String, String>,
    idle: VecDeque<String>,
}

#[derive(Default)]
pub struct Media {
    client: reqwest::Client,
    servers: Mutex<Servers>,
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

async fn reply(socket: &mut TcpStream, status: &str, extra: &str) -> std::io::Result<()> {
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
    let mut upstream = client.get(&source.url).header("accept-encoding", "identity");
    for (name, value) in source.headers.iter().chain(forwarded.iter().map(|(name, value)| (name, value))) {
        upstream = upstream.header(name, value);
    }
    let mut response = match timeout(UPSTREAM_WAIT, upstream.send()).await {
        Ok(Ok(response)) => response,
        Ok(Err(_)) => return reply(&mut socket, "502 Bad Gateway", "").await,
        Err(_) => return reply(&mut socket, "504 Gateway Timeout", "").await,
    };
    let status = response.status();
    let mut answer = format!("HTTP/1.1 {} {}\r\n", status.as_u16(), status.canonical_reason().unwrap_or_default());
    for name in PASSED {
        if let Some(value) = response.headers().get(name).and_then(|value| value.to_str().ok()) {
            answer.push_str(&format!("{name}: {value}\r\n"));
        }
    }
    answer.push_str(COMMON);
    answer.push_str("\r\n");
    socket.write_all(answer.as_bytes()).await?;
    if method == "HEAD" {
        return Ok(());
    }
    while let Ok(Ok(Some(chunk))) = timeout(UPSTREAM_WAIT, response.chunk()).await {
        timeout(WRITE_WAIT, socket.write_all(&chunk)).await.map_err(stalled)??;
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
    let source = Arc::new(Source { id: id.clone(), url, headers });
    let task = tauri::async_runtime::spawn(listen(listener, source, media.client.clone()));
    let mut servers = media.servers.lock().map_err(|error| error.to_string())?;
    if let Some(src) = reuse(&mut servers, &key, &id) {
        task.abort();
        return Ok(src);
    }
    let src = format!("http://{LOOPBACK}:{port}/{id}");
    servers.served.insert(key.clone(), Served { src: src.clone(), task, leases: 1 });
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
