use std::collections::HashMap;
use std::sync::{Arc, Mutex};

use tauri::http::header::CONTENT_TYPE;
use tauri::http::{Request, Response, StatusCode};
use tauri::utils::mime_type::MimeType;
use tauri::{Manager, Runtime, State, UriSchemeContext, UriSchemeResponder};
use tauri_plugin_http::reqwest;

pub const SCHEME: &str = "preview";

#[derive(Clone)]
struct Page {
    entry: String,
    html: Vec<u8>,
    assets: String,
    headers: HashMap<String, String>,
}

#[derive(Clone, Default)]
pub struct Previews {
    pages: Arc<Mutex<HashMap<String, Page>>>,
    client: reqwest::Client,
}

fn empty(status: StatusCode) -> Response<Vec<u8>> {
    let mut response = Response::new(Vec::new());
    *response.status_mut() = status;
    response
}

fn filled(status: u16, kind: String, body: Vec<u8>) -> Response<Vec<u8>> {
    Response::builder()
        .status(status)
        .header(CONTENT_TYPE, kind)
        .body(body)
        .unwrap_or_else(|_| empty(StatusCode::INTERNAL_SERVER_ERROR))
}

impl Previews {
    fn page(&self, id: &str) -> Option<Page> {
        self.pages.lock().ok()?.get(id).cloned()
    }

    async fn answer(&self, path: &str) -> Response<Vec<u8>> {
        let Some((id, rest)) = path.trim_start_matches('/').split_once('/') else {
            return empty(StatusCode::NOT_FOUND);
        };
        let Some(page) = self.page(id) else {
            return empty(StatusCode::NOT_FOUND);
        };
        if rest == page.entry {
            return filled(200, MimeType::Html.to_string(), page.html);
        }
        let mut request = self.client.get(format!("{}{rest}", page.assets));
        for (name, value) in &page.headers {
            request = request.header(name, value);
        }
        let Ok(response) = request.send().await else {
            return empty(StatusCode::BAD_GATEWAY);
        };
        let status = response.status().as_u16();
        match response.bytes().await {
            Ok(body) => filled(status, MimeType::parse(&body, rest), body.to_vec()),
            Err(_) => empty(StatusCode::BAD_GATEWAY),
        }
    }
}

pub fn serve<R: Runtime>(context: UriSchemeContext<'_, R>, request: Request<Vec<u8>>, responder: UriSchemeResponder) {
    let previews = context.app_handle().state::<Previews>().inner().clone();
    let path = request.uri().path().to_string();
    tauri::async_runtime::spawn(async move { responder.respond(previews.answer(&path).await) });
}

#[tauri::command]
pub fn preview_open(
    previews: State<'_, Previews>,
    id: String,
    entry: String,
    html: String,
    assets: String,
    headers: HashMap<String, String>,
) -> Result<(), String> {
    let page = Page {
        entry,
        html: html.into_bytes(),
        assets,
        headers,
    };
    previews.pages.lock().map_err(|error| error.to_string())?.insert(id, page);
    Ok(())
}

#[tauri::command]
pub fn preview_close(previews: State<'_, Previews>, id: String) {
    if let Ok(mut pages) = previews.pages.lock() {
        pages.remove(&id);
    }
}
