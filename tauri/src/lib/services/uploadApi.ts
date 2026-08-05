import { authHeadersOf, backend, baseUrlOf, type Profile } from "./backend.svelte";

export const UPLOAD_DIR = "uploads";
const OK_MIN = 200;
const OK_MAX = 299;

const encodePath = (path: string) =>
  path
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");

export const uploadAttachment = (
  file: File,
  onProgress: (value: number) => void,
  profile: Profile = backend.active,
  path = `${UPLOAD_DIR}/${file.name}`,
  signal?: AbortSignal,
): Promise<string | null> =>
  new Promise((resolve) => {
    const request = new XMLHttpRequest();
    request.open("PUT", `${baseUrlOf(profile)}/shared/${encodePath(path)}`);
    for (const [header, value] of Object.entries(authHeadersOf(profile))) request.setRequestHeader(header, value);
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
    request.onabort = () => resolve(null);
    signal?.addEventListener("abort", () => request.abort(), { once: true });
    request.send(file);
  });
