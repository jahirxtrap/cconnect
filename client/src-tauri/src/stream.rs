use std::collections::HashMap;
use std::sync::{Arc, Mutex};

use tauri::http::{Request, Response, StatusCode};
use tauri::{Manager, Runtime, State, UriSchemeContext, UriSchemeResponder};
use tauri_plugin_http::reqwest;

use crate::preview::empty;

pub const SCHEME: &str = "stream";
const CHUNK: u64 = 2 * 1024 * 1024;
const RANGE: &str = "range";
const PASSED: [&str; 4] = ["content-type", "content-range", "content-length", "accept-ranges"];

#[derive(Clone)]
struct Source {
    url: String,
    headers: HashMap<String, String>,
}

#[derive(Clone, Default)]
pub struct Streams {
    sources: Arc<Mutex<HashMap<String, Source>>>,
    client: reqwest::Client,
}

fn window(range: Option<&str>) -> String {
    let spec = range.and_then(|value| value.strip_prefix("bytes=")).unwrap_or("0-");
    let Some((start, end)) = spec.split_once('-') else {
        return format!("bytes={spec}");
    };
    let Ok(start) = start.trim().parse::<u64>() else {
        return format!("bytes={spec}");
    };
    let last = start + CHUNK - 1;
    let end = end.trim().parse::<u64>().map_or(last, |end| end.min(last));
    format!("bytes={start}-{end}")
}

impl Streams {
    fn source(&self, id: &str) -> Option<Source> {
        self.sources.lock().ok()?.get(id).cloned()
    }

    async fn answer(&self, path: &str, range: Option<String>) -> Response<Vec<u8>> {
        let Some(source) = self.source(path.trim_start_matches('/')) else {
            return empty(StatusCode::NOT_FOUND);
        };
        let mut request = self
            .client
            .get(&source.url)
            .header("accept-encoding", "identity")
            .header(RANGE, window(range.as_deref()));
        for (name, value) in &source.headers {
            request = request.header(name, value);
        }
        let Ok(response) = request.send().await else {
            return empty(StatusCode::BAD_GATEWAY);
        };
        let mut answer = Response::builder().status(response.status().as_u16());
        for name in PASSED {
            if let Some(value) = response.headers().get(name) {
                answer = answer.header(name, value.as_bytes());
            }
        }
        match response.bytes().await {
            Ok(body) => answer
                .body(body.to_vec())
                .unwrap_or_else(|_| empty(StatusCode::INTERNAL_SERVER_ERROR)),
            Err(_) => empty(StatusCode::BAD_GATEWAY),
        }
    }
}

pub fn serve<R: Runtime>(context: UriSchemeContext<'_, R>, request: Request<Vec<u8>>, responder: UriSchemeResponder) {
    let streams = context.app_handle().state::<Streams>().inner().clone();
    let path = request.uri().path().to_string();
    let range = request
        .headers()
        .get(RANGE)
        .and_then(|value| value.to_str().ok())
        .map(str::to_string);
    tauri::async_runtime::spawn(async move { responder.respond(streams.answer(&path, range).await) });
}

#[tauri::command]
pub fn stream_open(
    streams: State<'_, Streams>,
    id: String,
    url: String,
    headers: HashMap<String, String>,
) -> Result<(), String> {
    streams
        .sources
        .lock()
        .map_err(|error| error.to_string())?
        .insert(id, Source { url, headers });
    Ok(())
}

#[tauri::command]
pub fn stream_close(streams: State<'_, Streams>, id: String) {
    if let Ok(mut sources) = streams.sources.lock() {
        sources.remove(&id);
    }
}
