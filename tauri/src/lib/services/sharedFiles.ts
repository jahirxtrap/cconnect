import { isTauri } from "$lib/platform";
import { authHeadersOf, backend, type Profile } from "./backend.svelte";

export interface SharedItem {
  url: string;
  name: string;
}

const fetchShared = async (url: string, profile: Profile = backend.active): Promise<Blob | null> => {
  try {
    const response = await fetch(url, { headers: authHeadersOf(profile) });
    return response.ok ? await response.blob() : null;
  } catch {
    return null;
  }
};

const TEXT_TYPE = "text/markdown";

const saveBlob = (blob: Blob, filename: string) => {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(objectUrl);
};

export const downloadShared = async (url: string, filename: string) => {
  const blob = await fetchShared(url);
  if (blob) saveBlob(blob, filename);
};

export const saveTextToDownloads = (filename: string, text: string) =>
  saveBlob(new Blob([text], { type: TEXT_TYPE }), filename);

export const saveTextAs = (filename: string, text: string) =>
  saveBlobAs(new Blob([text], { type: TEXT_TYPE }), filename);

export const shareText = async (filename: string, text: string) => {
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
  saveTextToDownloads(filename, text);
};

const saveBlobAs = async (blob: Blob, filename: string) => {
  const picker = (
    window as unknown as {
      showSaveFilePicker?: (options: { suggestedName: string }) => Promise<FileSystemFileHandle>;
    }
  ).showSaveFilePicker;
  if (!picker) {
    saveBlob(blob, filename);
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
  const blob = await fetchShared(url);
  if (blob) await saveBlobAs(blob, filename);
};

export const saveAllShared = async (items: SharedItem[]) => {
  if (!isTauri) {
    for (const item of items) await downloadShared(item.url, item.name);
    return;
  }
  const { open } = await import("@tauri-apps/plugin-dialog");
  const directory = await open({ directory: true, multiple: false });
  if (typeof directory !== "string") return;
  const { writeFile } = await import("@tauri-apps/plugin-fs");
  for (const item of items) {
    const blob = await fetchShared(item.url);
    if (blob) await writeFile(`${directory}/${item.name}`, new Uint8Array(await blob.arrayBuffer()));
  }
};

export const openAllSharedExternally = async (items: SharedItem[]) => {
  await navigator.clipboard.writeText(items.map((item) => item.url).join("\n"));
};

export const openSharedExternally = async (url: string, filename: string) => {
  const blob = await fetchShared(url);
  const file = blob && new File([blob], filename, { type: blob.type });
  if (file && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return;
    } catch {
      return;
    }
  }
  window.open(url, "_blank", "noopener");
};
