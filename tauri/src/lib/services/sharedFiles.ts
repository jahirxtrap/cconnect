import { transfers } from "$lib/data/transfers.svelte";
import { isTauri, openExternal } from "$lib/platform";
import { androidDownloads, trackAndroidDownload } from "$lib/platform/androidDownloads";
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

const saveBlob = async (blob: Blob, filename: string): Promise<boolean> => {
  if (!isTauri) {
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(objectUrl);
    return true;
  }
  const bytes = new Uint8Array(await blob.arrayBuffer());
  try {
    const { writeFile, BaseDirectory } = await import("@tauri-apps/plugin-fs");
    await writeFile(filename, bytes, { baseDir: BaseDirectory.Download });
    return true;
  } catch {
    return false;
  }
};

export const downloadShared = (url: string, filename: string) => {
  const bridge = androidDownloads();
  if (bridge) {
    return transfers.download(filename, (onProgress, signal) => {
      const id = bridge.enqueue(url, filename, headersJson());
      if (!id) return Promise.resolve(false);
      return trackAndroidDownload(bridge, id, onProgress, signal);
    });
  }
  return transfers.download(filename, async (onProgress, signal) => {
    const blob = await fetchTracked(url, onProgress, signal);
    return blob !== null && (await saveBlob(blob, filename));
  });
};

export const saveTextToDownloads = async (filename: string, text: string) => {
  const bridge = androidDownloads();
  if (bridge) return bridge.saveText(filename, text);
  return saveBlob(new Blob([text], { type: TEXT_TYPE }), filename);
};

export const saveTextAs = async (filename: string, text: string) => {
  const bridge = androidDownloads();
  if (bridge) {
    bridge.saveText(filename, text);
    return;
  }
  await saveBlobAs(new Blob([text], { type: TEXT_TYPE }), filename);
};

export const shareText = async (filename: string, text: string) => {
  const bridge = androidDownloads();
  if (bridge) {
    bridge.shareText(filename, text);
    return;
  }
  const file = new File([text], filename, { type: TEXT_TYPE });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return;
    } catch {
      return;
    }
  }
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
  await transfers.download(filename, async (onProgress, signal) => {
    const blob = await fetchTracked(url, onProgress, signal);
    if (!blob) return false;
    await writeFile(target, new Uint8Array(await blob.arrayBuffer()));
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
    await transfers.download(item.name, async (onProgress, signal) => {
      const blob = await fetchTracked(item.url, onProgress, signal);
      if (!blob) return false;
      await writeFile(`${directory}/${item.name}`, new Uint8Array(await blob.arrayBuffer()));
      return true;
    });
  }
};

export const openAllSharedExternally = async (items: SharedItem[]) => {
  await navigator.clipboard.writeText(items.map((item) => item.url).join("\n"));
};

export const openSharedExternally = async (url: string, filename: string) => {
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
  const file = blob && new File([blob], filename, { type: (blob as Blob).type });
  if (file && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return;
    } catch {
      return;
    }
  }
  openExternal(url);
};
