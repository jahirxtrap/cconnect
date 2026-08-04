import { backend } from "./backend.svelte";

const UPLOAD_DIR = "uploads";
const OK_MIN = 200;
const OK_MAX = 299;

const uploadUrl = (name: string) => `${backend.baseUrl}/shared/${UPLOAD_DIR}/${encodeURIComponent(name)}`;

export const uploadAttachment = (file: File, onProgress: (value: number) => void): Promise<string | null> =>
  new Promise((resolve) => {
    const request = new XMLHttpRequest();
    request.open("PUT", uploadUrl(file.name));
    for (const [header, value] of Object.entries(backend.authHeaders)) request.setRequestHeader(header, value);
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total);
    };
    request.onload = () => {
      if (request.status < OK_MIN || request.status > OK_MAX) return resolve(null);
      try {
        const envelope = JSON.parse(request.responseText) as { data?: { path?: string } };
        onProgress(1);
        resolve(envelope.data?.path ?? null);
      } catch {
        resolve(null);
      }
    };
    request.onerror = () => resolve(null);
    request.send(file);
  });
