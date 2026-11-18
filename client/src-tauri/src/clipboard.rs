use gtk::gdk::SELECTION_CLIPBOARD;
use gtk::Clipboard;
use tauri::{AppHandle, Runtime};

use crate::opened::NativeFile;

const PASTED_NAME: &str = "image.png";
const PASTED_MIME: &str = "image/png";
const PNG: &str = "png";

#[tauri::command]
pub async fn clipboard_image<R: Runtime>(app: AppHandle<R>) -> Result<Vec<NativeFile>, String> {
    let (sender, receiver) = tokio::sync::oneshot::channel::<Option<Vec<u8>>>();
    app.run_on_main_thread(move || {
        Clipboard::get(&SELECTION_CLIPBOARD).request_image(move |_, image| {
            let _ = sender.send(image.and_then(|pixbuf| pixbuf.save_to_bufferv(PNG, &[]).ok()));
        });
    })
    .map_err(|error| error.to_string())?;
    let png = receiver.await.map_err(|_| "no answer".to_string())?;
    Ok(png.map(|data| NativeFile::new(PASTED_NAME, PASTED_MIME, &data)).into_iter().collect())
}
