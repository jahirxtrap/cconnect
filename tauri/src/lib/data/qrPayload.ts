export interface QrEnvironmentPayload {
  url: string;
  token: string;
}

export const parseQrPayload = (raw: string): QrEnvironmentPayload | null => {
  try {
    const data = JSON.parse(raw) as { url?: unknown; token?: unknown };
    const url = typeof data.url === "string" ? data.url.trim() : "";
    const token = typeof data.token === "string" ? data.token.trim() : "";
    return url && token ? { url, token } : null;
  } catch {
    return null;
  }
};
