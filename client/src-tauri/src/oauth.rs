use std::io::{BufRead, BufReader, Write};
use std::net::{TcpListener, TcpStream};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

const LOGO: &str = "<svg width=\"72\" height=\"72\" viewBox=\"0 0 108 108\" aria-hidden=\"true\">\
<path d=\"M24,0 L84,0 A24,24 0 0 1 108,24 L108,84 A24,24 0 0 1 84,108 L24,108 A24,24 0 0 1 0,84 L0,24 A24,24 0 0 1 24,0 Z\" fill=\"#171717\"/>\
<g transform=\"translate(54,54) scale(1.6) translate(-54,-54)\"><g transform=\"translate(19.93,18.8) scale(0.55)\">\
<path d=\"M21.94,64 a40,40 0 1,0 80,0 a40,40 0 1,0 -80,0\" fill=\"none\" stroke=\"#4D4D4D\" stroke-width=\"12\"/>\
<path d=\"M87.7,33.4 A40,40 0 1 0 87.7,94.6\" fill=\"none\" stroke=\"#FFFFFF\" stroke-width=\"12\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\
<path d=\"M46,52 L58,64 L46,76\" fill=\"none\" stroke=\"#FFFFFF\" stroke-width=\"10\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\
<path d=\"M64,76 L80,76\" fill=\"none\" stroke=\"#FFFFFF\" stroke-width=\"10\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\
</g></g></svg>";

const WAIT_LIMIT: Duration = Duration::from_secs(300);
const POLL: Duration = Duration::from_millis(150);
const HEX: u32 = 16;
const ESCAPE_LEN: usize = 3;

#[derive(Default)]
pub struct OauthState {
    listener: Mutex<Option<TcpListener>>,
    cancelled: Arc<AtomicBool>,
}

#[derive(Default, serde::Serialize)]
pub struct Redirect {
    code: String,
    state: String,
    error: String,
}

#[tauri::command]
pub fn oauth_start(state: tauri::State<'_, OauthState>) -> Result<u16, String> {
    let listener = TcpListener::bind(("127.0.0.1", 0)).map_err(|error| error.to_string())?;
    listener
        .set_nonblocking(true)
        .map_err(|error| error.to_string())?;
    let port = listener
        .local_addr()
        .map_err(|error| error.to_string())?
        .port();
    state.cancelled.store(false, Ordering::Relaxed);
    *state.listener.lock().unwrap() = Some(listener);
    Ok(port)
}

#[tauri::command]
pub async fn oauth_wait(
    state: tauri::State<'_, OauthState>,
    message: String,
) -> Result<Redirect, String> {
    let taken = state.listener.lock().unwrap().take();
    let listener = taken.ok_or_else(|| "oauth listener not started".to_string())?;
    let cancelled = state.cancelled.clone();
    tauri::async_runtime::spawn_blocking(move || accept(&listener, &cancelled, &message))
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn oauth_cancel(state: tauri::State<'_, OauthState>) {
    state.cancelled.store(true, Ordering::Relaxed);
    state.listener.lock().unwrap().take();
}

fn accept(listener: &TcpListener, cancelled: &AtomicBool, message: &str) -> Redirect {
    let deadline = Instant::now() + WAIT_LIMIT;
    while Instant::now() < deadline && !cancelled.load(Ordering::Relaxed) {
        match listener.accept() {
            Ok((stream, _)) => return answer(stream, message),
            Err(error) if error.kind() == std::io::ErrorKind::WouldBlock => std::thread::sleep(POLL),
            Err(_) => break,
        }
    }
    Redirect::default()
}

fn answer(mut stream: TcpStream, message: &str) -> Redirect {
    let mut line = String::new();
    let _ = BufReader::new(&stream).read_line(&mut line);
    let page = format!(
        "<!doctype html><meta charset=\"utf-8\"><title>CConnect</title>\
         <body style=\"margin:0;height:100vh;display:grid;place-items:center;background:#0a0a0a;color:#e6e6e6;font:16px/1.4 system-ui,-apple-system,Segoe UI,sans-serif\">\
         <main style=\"display:flex;flex-direction:column;align-items:center;gap:20px\">{LOGO}<p style=\"margin:0\">{message}</p></main>"
    );
    let _ = write!(
        stream,
        "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{page}",
        page.len()
    );
    let _ = stream.flush();
    parse(&line)
}

fn parse(request: &str) -> Redirect {
    let mut found = Redirect::default();
    let Some(target) = request.split_whitespace().nth(1) else {
        return found;
    };
    let Some((_, query)) = target.split_once('?') else {
        return found;
    };
    for pair in query.split('&') {
        let Some((key, value)) = pair.split_once('=') else {
            continue;
        };
        match key {
            "code" => found.code = decode(value),
            "state" => found.state = decode(value),
            "error" => found.error = decode(value),
            _ => {}
        }
    }
    found
}

fn decode(value: &str) -> String {
    let bytes = value.as_bytes();
    let mut plain = Vec::with_capacity(bytes.len());
    let mut at = 0;
    while at < bytes.len() {
        match bytes[at] {
            b'%' if at + ESCAPE_LEN <= bytes.len() => {
                match u8::from_str_radix(&value[at + 1..at + ESCAPE_LEN], HEX) {
                    Ok(byte) => {
                        plain.push(byte);
                        at += ESCAPE_LEN;
                    }
                    Err(_) => {
                        plain.push(b'%');
                        at += 1;
                    }
                }
            }
            b'+' => {
                plain.push(b' ');
                at += 1;
            }
            byte => {
                plain.push(byte);
                at += 1;
            }
        }
    }
    String::from_utf8_lossy(&plain).into_owned()
}
