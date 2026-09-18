import { transfers } from "$lib/data/transfers.svelte";
import { isDesktop, isTauri, openExternal } from "$lib/platform";
import { androidDownloads, trackAndroidDownload } from "$lib/platform/androidDownloads";
import { copyText } from "$lib/platform/clipboard";
import { authHeadersOf, backend, type Profile } from "./backend.svelte";

export interface SharedItem {
  url: string;
  name: string;
}

const fetchTracked = async (
  url: string,
  onProgress: (value: number) => void,
  signal: AbortSignal,
  profile: Profile = backend.active,
): Promise<Blob | null> => {
  try {
    const response = await fetch(url, { headers: authHeadersOf(profile), signal });
    if (!response.ok) return null;
    const total = Number(response.headers.get("content-length")) || 0;
    if (!response.body || !total) return await response.blob();
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let received = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      received += value.length;
      onProgress(Math.min(1, received / total));
    }
    return new Blob(chunks as BlobPart[], { type: response.headers.get("content-type") ?? "" });
  } catch {
    return null;
  }
};

const TEXT_TYPE = "text/markdown";

const headersJson = (profile: Profile = backend.active) => JSON.stringify(authHeadersOf(profile));

const saveBlob = async (blob: Blob, filename: string): Promise<string | null> => {
  if (!isTauri) {
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(objectUrl);
    return "";
  }
  const bytes = new Uint8Array(await blob.arrayBuffer());
  try {
    const { writeFile, BaseDirectory } = await import("@tauri-apps/plugin-fs");
    await writeFile(filename, bytes, { baseDir: BaseDirectory.Download });
    const { downloadDir, join } = await import("@tauri-apps/api/path");
    return await join(await downloadDir(), filename);
  } catch {
    return null;
  }
};

const DRAG_ICON = 64;

let dragIcon: string | null = null;

const dragIconData = async (): Promise<string> => {
  if (dragIcon) return dragIcon;
  const source = new Image();
  source.src = "/favicon.png";
  await source.decode();
  const canvas = document.createElement("canvas");
  canvas.width = DRAG_ICON;
  canvas.height = DRAG_ICON;
  canvas.getContext("2d")?.drawImage(source, 0, 0, DRAG_ICON, DRAG_ICON);
  dragIcon = canvas.toDataURL("image/png");
  return dragIcon;
};

export const dragSaved = async (path: string) => {
  if (!isDesktop || !path) return;
  try {
    const { startDrag } = await import("@crabnebula/tauri-plugin-drag");
    await startDrag({ item: [path], icon: await dragIconData() });
  } catch {
    return;
  }
};

const openSaved = async (path: string): Promise<boolean> => {
  try {
    const { openPath } = await import("@tauri-apps/plugin-opener");
    await openPath(path);
    return true;
  } catch {
    return false;
  }
};

export const downloadShared = (url: string, filename: string) => {
  const bridge = androidDownloads();
  if (bridge) {
    return transfers.download(
      filename,
      (onProgress, signal, keep) => {
        const id = bridge.enqueue(url, filename, headersJson());
        if (!id) return Promise.resolve(false);
        keep(id);
        return trackAndroidDownload(bridge, id, onProgress, signal);
      },
      url,
    );
  }
  return transfers.download(
    filename,
    async (onProgress, signal, keep) => {
      const blob = await fetchTracked(url, onProgress, signal);
      if (!blob) return false;
      const saved = await saveBlob(blob, filename);
      if (saved) keep(saved);
      return saved !== null;
    },
    url,
  );
};

export const saveTextToDownloads = async (filename: string, text: string) => {
  const bridge = androidDownloads();
  if (bridge) return bridge.saveText(filename, text);
  return transfers.download(filename, async (_progress, _signal, keep) => {
    const saved = await saveBlob(new Blob([text], { type: TEXT_TYPE }), filename);
    if (saved) keep(saved);
    return saved !== null;
  });
};

export const saveTextAs = async (filename: string, text: string) => {
  const bridge = androidDownloads();
  if (bridge) {
    bridge.saveText(filename, text);
    return;
  }
  await saveBlobAs(new Blob([text], { type: TEXT_TYPE }), filename);
};

const shareFile = async (file: File): Promise<boolean> => {
  if (!navigator.canShare?.({ files: [file] })) return false;
  try {
    await navigator.share({ files: [file] });
  } catch {
    return true;
  }
  return true;
};

export const shareText = async (filename: string, text: string) => {
  const bridge = androidDownloads();
  if (bridge) {
    bridge.shareText(filename, text);
    return;
  }
  if (await shareFile(new File([text], filename, { type: TEXT_TYPE }))) return;
  if (navigator.share) {
    try {
      await navigator.share({ title: filename, text });
      return;
    } catch {
      return;
    }
  }
  await saveTextToDownloads(filename, text);
};

const saveBlobAs = async (blob: Blob, filename: string) => {
  const picker = (
    window as unknown as {
      showSaveFilePicker?: (options: { suggestedName: string }) => Promise<FileSystemFileHandle>;
    }
  ).showSaveFilePicker;
  if (!picker) {
    await saveBlob(blob, filename);
    return;
  }
  try {
    const handle = await picker({ suggestedName: filename });
    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
  } catch {
    return;
  }
};

export const saveSharedAs = async (url: string, filename: string) => {
  const bridge = androidDownloads();
  if (bridge) {
    bridge.saveAs(url, filename, headersJson());
    return;
  }
  if (!isTauri) {
    await transfers.download(filename, async (onProgress, signal) => {
      const blob = await fetchTracked(url, onProgress, signal);
      if (!blob) return false;
      await saveBlobAs(blob, filename);
      return true;
    });
    return;
  }
  const { save } = await import("@tauri-apps/plugin-dialog");
  const target = await save({ defaultPath: filename });
  if (typeof target !== "string") return;
  const { writeFile } = await import("@tauri-apps/plugin-fs");
  await transfers.download(filename, async (onProgress, signal, keep) => {
    const blob = await fetchTracked(url, onProgress, signal);
    if (!blob) return false;
    await writeFile(target, new Uint8Array(await blob.arrayBuffer()));
    keep(target);
    return true;
  });
};

export const saveAllShared = async (items: SharedItem[]) => {
  if (androidDownloads() || !isTauri) {
    for (const item of items) await downloadShared(item.url, item.name);
    return;
  }
  const { open } = await import("@tauri-apps/plugin-dialog");
  const directory = await open({ directory: true, multiple: false });
  if (typeof directory !== "string") return;
  const { writeFile } = await import("@tauri-apps/plugin-fs");
  for (const item of items) {
    await transfers.download(item.name, async (onProgress, signal, keep) => {
      const blob = await fetchTracked(item.url, onProgress, signal);
      if (!blob) return false;
      const target = `${directory}/${item.name}`;
      await writeFile(target, new Uint8Array(await blob.arrayBuffer()));
      keep(target);
      return true;
    });
  }
};

export const downloadAllShared = async (items: SharedItem[]) => {
  for (const item of items) await downloadShared(item.url, item.name);
};

export const saveSharedItemsAs = async (items: SharedItem[]) => {
  if (items.length === 1) await saveSharedAs(items[0].url, items[0].name);
  else if (items.length) await saveAllShared(items);
};

export const shareAllShared = async (items: SharedItem[]) => {
  await copyText(items.map((item) => item.url).join("\n"));
};

export const shareShared = async (url: string, filename: string) => {
  const bridge = androidDownloads();
  if (bridge) {
    bridge.share(url, filename, headersJson());
    return;
  }
  let blob: Blob | null = null;
  await transfers.download(filename, async (onProgress, signal) => {
    blob = await fetchTracked(url, onProgress, signal);
    return blob !== null;
  });
  const found = blob as Blob | null;
  if (found && (await shareFile(new File([found], filename, { type: found.type })))) return;
  openExternal(url);
};

export const openTransfer = async (saved: string, url: string, filename: string) => {
  const bridge = androidDownloads();
  if (saved) {
    if (bridge && bridge.openSaved(saved)) return;
    if (!bridge && isTauri && (await openSaved(saved))) return;
  }
  await openSharedExternally(url, filename);
};

export const openSharedExternally = async (url: string, filename: string) => {
  const bridge = androidDownloads();
  if (bridge) {
    bridge.open(url, filename, headersJson());
    return;
  }
  const blob = await fetchTracked(url, () => {}, new AbortController().signal);
  if (!blob) return;
  if (!isTauri) {
    const objectUrl = URL.createObjectURL(blob);
    window.open(objectUrl, "_blank", "noopener");
    return;
  }
  try {
    const { writeFile, mkdir, BaseDirectory } = await import("@tauri-apps/plugin-fs");
    const target = `cconnect/${filename}`;
    await mkdir("cconnect", { baseDir: BaseDirectory.Temp, recursive: true });
    await writeFile(target, new Uint8Array(await (blob as Blob).arrayBuffer()), { baseDir: BaseDirectory.Temp });
    const { tempDir, join } = await import("@tauri-apps/api/path");
    const { openPath } = await import("@tauri-apps/plugin-opener");
    await openPath(await join(await tempDir(), target));
  } catch {
    openExternal(url);
  }
};
