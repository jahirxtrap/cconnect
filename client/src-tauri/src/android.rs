use std::sync::OnceLock;

use jni::objects::{JClass, JString};
use jni::sys::{jboolean, jstring, JNI_FALSE, JNI_TRUE};
use jni::JNIEnv;
use tauri::{AppHandle, Manager, Wry};

use crate::shield::Shield;

static APP: OnceLock<AppHandle<Wry>> = OnceLock::new();

pub fn install(app: &AppHandle<Wry>) {
    let _ = APP.set(app.clone());
}

fn text(env: &mut JNIEnv, value: &JString) -> String {
    env.get_string(value).map(Into::into).unwrap_or_default()
}

fn answer(env: &mut JNIEnv, value: &str) -> jstring {
    env.new_string(value).map(|value| value.into_raw()).unwrap_or(std::ptr::null_mut())
}

fn kind_of(url: &str, accept: &str) -> &'static str {
    let path = url.split(['?', '#']).next().unwrap_or_default();
    let name = path.rsplit('/').next().unwrap_or_default();
    let extension = name.rsplit_once('.').map(|(_, extension)| extension.to_ascii_lowercase()).unwrap_or_default();
    match extension.as_str() {
        "js" | "mjs" => "script",
        "css" => "stylesheet",
        "png" | "jpg" | "jpeg" | "gif" | "webp" | "svg" | "ico" | "avif" | "bmp" => "image",
        "woff" | "woff2" | "ttf" | "otf" | "eot" => "font",
        "mp4" | "webm" | "mp3" | "m4a" | "ogg" | "wav" | "m3u8" => "media",
        _ if accept.starts_with("text/css") => "stylesheet",
        _ if accept.starts_with("image/") => "image",
        _ if accept.contains("text/html") => "subdocument",
        _ => "other",
    }
}

#[no_mangle]
pub extern "system" fn Java_com_jahirtrap_cconnect_BrowserNative_blocks(
    mut env: JNIEnv,
    _: JClass,
    url: JString,
    source: JString,
    accept: JString,
) -> jboolean {
    let Some(app) = APP.get() else {
        return JNI_FALSE;
    };
    let (url, source, accept) = (text(&mut env, &url), text(&mut env, &source), text(&mut env, &accept));
    match app.state::<Shield>().blocks(&url, &source, kind_of(&url, &accept)) {
        true => JNI_TRUE,
        false => JNI_FALSE,
    }
}

#[no_mangle]
pub extern "system" fn Java_com_jahirtrap_cconnect_BrowserNative_hiding(
    mut env: JNIEnv,
    _: JClass,
    url: JString,
) -> jstring {
    let url = text(&mut env, &url);
    let script = APP.get().and_then(|app| app.state::<Shield>().hiding(&url)).unwrap_or_default();
    answer(&mut env, &script)
}

#[no_mangle]
pub extern "system" fn Java_com_jahirtrap_cconnect_BrowserNative_pageScript(mut env: JNIEnv, _: JClass) -> jstring {
    answer(&mut env, crate::PAGE_SCRIPT)
}
