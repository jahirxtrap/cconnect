import { store } from "$lib/platform/storage";

export type NotesView = "cards" | "list";

export interface Note {
  id: string;
  body: string;
  title?: string;
  updatedAt: number;
  deletedAt?: number;
}

interface History {
  past: string[];
  future: string[];
  at: number;
}

const ITEMS_KEY = "notes.items";
const VIEW_KEY = "notes.view";
const LEGACY_KEY = "notes.scratch";
const SAVE_DELAY_MS = 400;
const TITLE_LIMIT = 80;
const HISTORY_GAP_MS = 800;
const HISTORY_LIMIT = 200;

const stripped = (line: string) =>
  line
    .replace(/^#{1,6}\s+/, "")
    .replace(/^[-*]\s+\[[ xX]\]\s+/, "")
    .replace(/^[-*]\s+/, "")
    .replace(/^\d+[.)]\s+/, "")
    .trim();

export const noteTitle = (note: Note): string => {
  if (note.title) return note.title;
  const line = note.body.split("\n").map(stripped).find((text) => text.length > 0) ?? "";
  return line.slice(0, TITLE_LIMIT);
};

export const notePreview = (body: string): string => {
  const lines = body.split("\n").map(stripped).filter((text) => text.length > 0);
  return lines.slice(1).join(" ");
};

const restored = (): Note[] => {
  const saved = store.get<Note[] | null>(ITEMS_KEY, null);
  if (saved) return saved;
  const legacy = store.get(LEGACY_KEY, "");
  return legacy.trim() ? [{ id: crypto.randomUUID(), body: legacy, updatedAt: Date.now() }] : [];
};

class Notes {
  items = $state<Note[]>(restored());
  view = $state<NotesView>(store.get<NotesView>(VIEW_KEY, "cards"));
  formatted = $state(false);
  searching = $state(false);
  query = $state("");
  history = $state<Record<string, History>>({});

  #timer: ReturnType<typeof setTimeout> | null = null;

  readonly listed = $derived.by(() => {
    const needle = this.searching ? this.query.trim().toLowerCase() : "";
    return this.items
      .filter((note) => !note.deletedAt)
      .filter((note) => !needle || `${note.title ?? ""}\n${note.body}`.toLowerCase().includes(needle))
      .sort((left, right) => right.updatedAt - left.updatedAt);
  });

  search(on: boolean) {
    this.searching = on;
    if (!on) this.query = "";
  }

  find(id: string): Note | null {
    return this.items.find((note) => note.id === id && !note.deletedAt) ?? null;
  }

  create(): string {
    const note: Note = { id: crypto.randomUUID(), body: "", updatedAt: Date.now() };
    this.items = [...this.items, note];
    return note.id;
  }

  rename(id: string, title: string) {
    const named = title.trim();
    this.items = this.items.map((note) =>
      note.id === id ? { ...note, title: named || undefined, updatedAt: Date.now() } : note,
    );
    this.#save();
  }

  duplicate(id: string): string | null {
    const note = this.find(id);
    if (!note) return null;
    const copy: Note = { id: crypto.randomUUID(), body: note.body, title: note.title, updatedAt: Date.now() };
    this.items = [...this.items, copy];
    this.#save();
    return copy.id;
  }

  write(id: string, body: string) {
    this.#change(id, body, true);
  }

  apply(id: string, body: string) {
    this.#change(id, body, false);
  }

  #change(id: string, body: string, coalesce: boolean) {
    const current = this.find(id);
    if (!current || current.body === body) return;
    this.#record(id, current.body, coalesce);
    this.#set(id, body);
  }

  undo(id: string) {
    const entry = this.history[id];
    const note = this.find(id);
    if (!entry?.past.length || !note) return;
    this.history[id] = {
      past: entry.past.slice(0, -1),
      future: [...entry.future, note.body],
      at: 0,
    };
    this.#set(id, entry.past[entry.past.length - 1]);
  }

  redo(id: string) {
    const entry = this.history[id];
    const note = this.find(id);
    if (!entry?.future.length || !note) return;
    this.history[id] = {
      past: [...entry.past, note.body],
      future: entry.future.slice(0, -1),
      at: 0,
    };
    this.#set(id, entry.future[entry.future.length - 1]);
  }

  #record(id: string, previous: string, coalesce: boolean) {
    const entry = this.history[id] ?? { past: [], future: [], at: 0 };
    const now = Date.now();
    const apart = !coalesce || now - entry.at > HISTORY_GAP_MS;
    const past = apart ? [...entry.past, previous].slice(-HISTORY_LIMIT) : entry.past;
    this.history[id] = { past, future: [], at: coalesce ? now : 0 };
  }

  #set(id: string, body: string) {
    this.items = this.items.map((note) => (note.id === id ? { ...note, body, updatedAt: Date.now() } : note));
    this.#schedule();
  }

  remove(id: string) {
    this.items = this.items.map((note) =>
      note.id === id ? { ...note, body: "", updatedAt: Date.now(), deletedAt: Date.now() } : note,
    );
    this.#save();
  }

  discardEmpty(id: string) {
    const note = this.find(id);
    if (!note || note.body.trim()) return;
    this.items = this.items.filter((item) => item.id !== id);
    this.#save();
  }

  replaceAll(items: Note[]) {
    this.items = items;
    this.history = {};
    this.#save();
  }

  show(view: NotesView) {
    this.view = view;
    store.set(VIEW_KEY, view);
  }

  #schedule() {
    if (this.#timer !== null) clearTimeout(this.#timer);
    this.#timer = setTimeout(() => this.#save(), SAVE_DELAY_MS);
  }

  #save() {
    if (this.#timer !== null) clearTimeout(this.#timer);
    this.#timer = null;
    store.set(ITEMS_KEY, this.items);
    store.remove(LEGACY_KEY);
  }
}

export const notes = new Notes();
