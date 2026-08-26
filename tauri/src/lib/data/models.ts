export interface ProjectInfo {
  projectKey: string;
  path: string | null;
  name: string | null;
  sessionCount: number;
  lastActive: number | null;
}

export interface ChatCategory {
  id: string;
  name: string;
  position: number;
  color: string | null;
  collapsed: boolean;
}

export interface ChatPlacement {
  sessionId: string;
  categoryId: string | null;
  position: number;
}

export interface SessionInfo {
  sessionId: string;
  projectKey: string | null;
  path: string | null;
  lastActive: number | null;
  size: number;
  preview: string | null;
  title: string | null;
  color: string | null;
  activity: string | null;
}

export interface SharedEntry {
  name: string;
  isDir: boolean;
  size: number;
  modified: number;
  items: number;
}

type Wire = Record<string, unknown>;

const text = (value: unknown): string | null => (typeof value === "string" ? value : null);
const number = (value: unknown): number | null => (typeof value === "number" ? value : null);

export const parseProject = (raw: Wire): ProjectInfo => ({
  projectKey: text(raw.project_key) ?? "",
  path: text(raw.path),
  name: text(raw.name),
  sessionCount: number(raw.session_count) ?? 0,
  lastActive: number(raw.last_active),
});

export const parseSession = (raw: Wire): SessionInfo => ({
  sessionId: text(raw.session_id) ?? "",
  projectKey: text(raw.project_key),
  path: text(raw.path),
  lastActive: number(raw.last_active),
  size: number(raw.size) ?? 0,
  preview: text(raw.preview),
  title: text(raw.title),
  color: text(raw.color),
  activity: text(raw.activity),
});

export const parseCategory = (raw: Wire): ChatCategory => ({
  id: text(raw.id) ?? "",
  name: text(raw.name) ?? "",
  position: number(raw.position) ?? 0,
  color: text(raw.color),
  collapsed: raw.collapsed === true,
});

export const parsePlacement = (raw: Wire): ChatPlacement => ({
  sessionId: text(raw.session_id) ?? "",
  categoryId: text(raw.category_id),
  position: number(raw.position) ?? 0,
});

export const parseSharedEntry = (raw: Wire): SharedEntry => ({
  name: text(raw.name) ?? "",
  isDir: raw.is_dir === true,
  size: number(raw.size) ?? 0,
  modified: number(raw.modified) ?? 0,
  items: number(raw.items) ?? 0,
});
