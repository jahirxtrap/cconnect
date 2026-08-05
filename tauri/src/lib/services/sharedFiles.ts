import { authHeadersOf, backend, type Profile } from "./backend.svelte";

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
