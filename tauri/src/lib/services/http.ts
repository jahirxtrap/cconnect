import { authHeadersOf, backend, baseUrlOf, isConfigured, type Profile } from "./backend.svelte";

type Query = Record<string, string | number | boolean | undefined>;

interface Envelope<T> {
  success: boolean;
  status: number;
  message: string;
  data?: T;
}

export interface HttpClient {
  get: <T>(path: string, query?: Query) => Promise<T | null>;
  post: <T>(path: string, body?: unknown) => Promise<T | null>;
  put: <T>(path: string, body?: unknown) => Promise<T | null>;
  patch: <T>(path: string, body?: unknown) => Promise<T | null>;
  delete: <T>(path: string, query?: Query) => Promise<T | null>;
}

const withQuery = (base: string, path: string, query?: Query) => {
  const url = `${base}${path}`;
  if (!query) return url;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) params.set(key, String(value));
  }
  const search = params.toString();
  return search ? `${url}?${search}` : url;
};

export const createHttp = (profile: () => Profile, extraHeaders?: () => Record<string, string>): HttpClient => {
  const execute = async <T>(method: string, path: string, query?: Query, body?: unknown): Promise<T | null> => {
    const target = profile();
    if (!isConfigured(target)) return null;
    try {
      const response = await fetch(withQuery(baseUrlOf(target), path, query), {
        method,
        headers: {
          ...authHeadersOf(target),
          ...(extraHeaders?.() ?? {}),
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

  return {
    get: <T>(path: string, query?: Query) => execute<T>("GET", path, query),
    post: <T>(path: string, body?: unknown) => execute<T>("POST", path, undefined, body ?? {}),
    put: <T>(path: string, body?: unknown) => execute<T>("PUT", path, undefined, body ?? {}),
    patch: <T>(path: string, body?: unknown) => execute<T>("PATCH", path, undefined, body ?? {}),
    delete: <T>(path: string, query?: Query) => execute<T>("DELETE", path, query),
  };
};

export const http = createHttp(() => backend.active);
