export const CCONNECT_LANG = "cconnect";

const MAX_SUGGESTIONS = 3;

export interface GalleryItem {
  url: string;
  alt?: string;
  poster?: string;
}

export interface PlaylistItem {
  url: string;
  title?: string;
  duration?: number;
}

export type SuggestionMode = "send" | "draft";

export interface SuggestionItem {
  text: string;
  mode: SuggestionMode;
}

export interface SuggestionPicker {
  pick: (item: SuggestionItem) => void;
  sends: boolean;
}

export type CconnectBlock =
  | { type: "gallery"; items: GalleryItem[] }
  | { type: "playlist"; items: PlaylistItem[] }
  | { type: "pdf"; url: string; title?: string }
  | { type: "html"; url: string; title?: string }
  | { type: "suggestions"; items: SuggestionItem[] };

const str = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim() ? value : undefined;

const num = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined;

const items = (value: unknown): Record<string, unknown>[] =>
  Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => !!item && typeof item === "object") : [];

export function parseCconnectBlock(source: string): CconnectBlock | null {
  let raw: unknown;
  try {
    raw = JSON.parse(source);
  } catch {
    return null;
  }
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Record<string, unknown>;

  switch (data.type) {
    case "gallery": {
      const list = items(data.items).flatMap<GalleryItem>((item) => {
        const url = str(item.url);
        return url ? [{ url, alt: str(item.alt), poster: str(item.poster) }] : [];
      });
      return list.length ? { type: "gallery", items: list } : null;
    }
    case "playlist": {
      const list = items(data.items).flatMap<PlaylistItem>((item) => {
        const url = str(item.url);
        return url ? [{ url, title: str(item.title), duration: num(item.duration) }] : [];
      });
      return list.length ? { type: "playlist", items: list } : null;
    }
    case "pdf": {
      const url = str(data.url);
      return url ? { type: "pdf", url, title: str(data.title) } : null;
    }
    case "html": {
      const url = str(data.url);
      return url ? { type: "html", url, title: str(data.title) } : null;
    }
    case "suggestions": {
      const list = Array.isArray(data.items)
        ? data.items.flatMap<SuggestionItem>((item) => {
            const entry = typeof item === "string" ? { text: item } : item;
            if (!entry || typeof entry !== "object") return [];
            const text = str((entry as Record<string, unknown>).text);
            if (!text) return [];
            const mode = str((entry as Record<string, unknown>).mode);
            return [{ text: text.trim(), mode: mode === "draft" ? "draft" : "send" }];
          })
        : [];
      return list.length ? { type: "suggestions", items: list.slice(0, MAX_SUGGESTIONS) } : null;
    }
    default:
      return null;
  }
}
