use std::collections::HashMap;
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
const HEAD_LIMIT: usize = 16 * 1024;
const HEAD_END: &[u8] = b"\r\n\r\n";
const PASSED: [&str; 4] = ["content-type", "content-length", "content-range", "accept-ranges"];
const COMMON: &str = "cache-control: no-store\r\naccess-control-allow-origin: *\r\naccess-control-expose-headers: content-type, content-length, content-range, accept-ranges\r\nconnection: close\r\n";
const PREFLIGHT: &str = "access-control-allow-methods: GET, HEAD, OPTIONS\r\naccess-control-allow-headers: range\r\naccess-control-max-age: 600\r\n";

struct Source {
    id: String,
    url: String,
    headers: HashMap<String, String>,
}

#[derive(Default)]
pub struct Media {
    client: reqwest::Client,
    listeners: Mutex<HashMap<String, JoinHandle<()>>>,
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
    let range = lines
        .filter_map(|line| line.split_once(':'))
        .find(|(name, _)| name.trim().eq_ignore_ascii_case("range"))
        .map(|(_, value)| value.trim().to_string());
    if method == "OPTIONS" {
        return reply(&mut socket, "204 No Content", PREFLIGHT).await;
    }
    let id = target.trim_start_matches('/').split(['?', '#']).next().unwrap_or_default();
    if id != source.id {
        return reply(&mut socket, "404 Not Found", "").await;
    }
    let mut upstream = client.get(&source.url).header("accept-encoding", "identity");
    for (name, value) in &source.headers {
        upstream = upstream.header(name, value);
    }
    if let Some(range) = &range {
        upstream = upstream.header("range", range);
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
    let listener = TcpListener::bind((LOOPBACK, 0)).await.map_err(|error| error.to_string())?;
    let port = listener.local_addr().map_err(|error| error.to_string())?.port();
    let source = Arc::new(Source { id: id.clone(), url, headers });
    let task = tauri::async_runtime::spawn(listen(listener, source, media.client.clone()));
    let replaced = media
        .listeners
        .lock()
        .map_err(|error| error.to_string())?
        .insert(id.clone(), task);
    if let Some(replaced) = replaced {
        replaced.abort();
    }
    Ok(format!("http://{LOOPBACK}:{port}/{id}"))
}

#[tauri::command]
pub fn media_close(media: State<'_, Media>, id: String) {
    let closed = media.listeners.lock().ok().and_then(|mut listeners| listeners.remove(&id));
    if let Some(closed) = closed {
        closed.abort();
    }
}
