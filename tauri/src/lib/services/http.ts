import { backend } from "./backend.svelte";

type Query = Record<string, string | number | boolean | undefined>;

interface Envelope<T> {
  success: boolean;
  status: number;
  message: string;
  data?: T;
}

const withQuery = (path: string, query?: Query) => {
  const url = `${backend.baseUrl}${path}`;
  if (!query) return url;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) params.set(key, String(value));
  }
  const search = params.toString();
  return search ? `${url}?${search}` : url;
};

const execute = async <T>(method: string, path: string, query?: Query, body?: unknown): Promise<T | null> => {
  if (!backend.configured) return null;
  try {
    const response = await fetch(withQuery(path, query), {
      method,
      headers: {
        ...backend.authHeaders,
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body ?? {}),
    });
    const envelope = (await response.json()) as Envelope<T>;
    return envelope.success ? (envelope.data ?? ({} as T)) : null;
  } catch {
    return null;
  }
};

export const http = {
  get: <T>(path: string, query?: Query) => execute<T>("GET", path, query),
  post: <T>(path: string, body?: unknown) => execute<T>("POST", path, undefined, body ?? {}),
  put: <T>(path: string, body?: unknown) => execute<T>("PUT", path, undefined, body ?? {}),
  delete: <T>(path: string, query?: Query) => execute<T>("DELETE", path, query),
};
