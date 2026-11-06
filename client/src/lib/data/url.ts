export const withQuery = (url: string, name: string, value: string | number) =>
  `${url}${url.includes("?") ? "&" : "?"}${name}=${encodeURIComponent(value)}`;

const FALLBACK_MARK = "?fb=";

export const withFallback = (url: string, fallback: string | null | undefined) =>
  fallback ? `${url}${FALLBACK_MARK}${encodeURIComponent(fallback)}` : url;

export const withoutFallback = (url: string) => url.split(FALLBACK_MARK)[0];

export const fallbackOf = (url: string): string | null => {
  const encoded = url.split(FALLBACK_MARK)[1];
  return encoded ? decodeURIComponent(encoded) : null;
};

export const revised = (url: string, revision: number) => (revision > 0 ? withQuery(url, "cb", revision) : url);
