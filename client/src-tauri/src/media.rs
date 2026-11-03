use std::collections::HashMap;
use std::sync::{Arc, Mutex};

use tauri::State;
use tauri_plugin_http::reqwest;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::OnceCell;

const LOOPBACK: &str = "127.0.0.1";
const HEAD_LIMIT: usize = 16 * 1024;
const HEAD_END: &[u8] = b"\r\n\r\n";
const PASSED: [&str; 4] = ["content-type", "content-length", "content-range", "accept-ranges"];
const COMMON: &str = "cache-control: no-store\r\naccess-control-allow-origin: *\r\naccess-control-expose-headers: content-type, content-length, content-range, accept-ranges\r\nconnection: close\r\n";
const PREFLIGHT: &str = "access-control-allow-methods: GET, HEAD, OPTIONS\r\naccess-control-allow-headers: range\r\naccess-control-max-age: 600\r\n";

type Sources = Arc<Mutex<HashMap<String, Source>>>;

#[derive(Clone)]
struct Source {
    url: String,
    headers: HashMap<String, String>,
}

#[derive(Default)]
pub struct Media {
    sources: Sources,
    client: reqwest::Client,
    port: OnceCell<u16>,
}

impl Media {
    async fn port(&self) -> Result<u16, String> {
        self.port
            .get_or_try_init(|| async {
                let listener = TcpListener::bind((LOOPBACK, 0)).await.map_err(|error| error.to_string())?;
                let port = listener.local_addr().map_err(|error| error.to_string())?.port();
                let (sources, client) = (self.sources.clone(), self.client.clone());
                tauri::async_runtime::spawn(async move {
                    while let Ok((socket, _)) = listener.accept().await {
                        let (sources, client) = (sources.clone(), client.clone());
                        tauri::async_runtime::spawn(async move {
                            let _ = serve(socket, &sources, &client).await;
                        });
                    }
                });
                Ok(port)
            })
            .await
            .copied()
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

async fn serve(mut socket: TcpStream, sources: &Sources, client: &reqwest::Client) -> std::io::Result<()> {
    let head = read_head(&mut socket).await?;
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
    let source = sources.lock().ok().and_then(|registered| registered.get(id).cloned());
    let Some(source) = source else {
        return reply(&mut socket, "404 Not Found", "").await;
    };
    let mut upstream = client.get(&source.url).header("accept-encoding", "identity");
    for (name, value) in &source.headers {
        upstream = upstream.header(name, value);
    }
    if let Some(range) = &range {
        upstream = upstream.header("range", range);
    }
    let Ok(mut response) = upstream.send().await else {
        return reply(&mut socket, "502 Bad Gateway", "").await;
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
    while let Ok(Some(chunk)) = response.chunk().await {
        socket.write_all(&chunk).await?;
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
    let port = media.port().await?;
    media
        .sources
        .lock()
        .map_err(|error| error.to_string())?
        .insert(id.clone(), Source { url, headers });
    Ok(format!("http://{LOOPBACK}:{port}/{id}"))
}

#[tauri::command]
pub fn media_close(media: State<'_, Media>, id: String) {
    if let Ok(mut sources) = media.sources.lock() {
        sources.remove(&id);
    }
}
