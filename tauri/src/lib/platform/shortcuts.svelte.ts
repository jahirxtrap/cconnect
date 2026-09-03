import { isTauri, isTouch, platformName } from "./index";
import { store } from "./storage";

export type ShortcutScope = "global" | "chat" | "terminal" | "files";

export interface ShortcutDef {
  id: string;
  label: string;
  scope: ShortcutScope;
  keys: string;
  mac?: string;
  web?: string;
}

const CUSTOM_KEY = "shortcuts";

const MAC = platformName() === "macos";

const NAMED_KEYS: Record<string, string> = {
  ArrowUp: "↑",
  ArrowDown: "↓",
  ArrowLeft: "←",
  ArrowRight: "→",
  Escape: "Esc",
  Delete: "Del",
  Backspace: MAC ? "⌫" : "Backspace",
  Space: "Space",
};

export const SHORTCUTS: ShortcutDef[] = [
  { id: "tab.new", label: "SHORTCUT_TAB_NEW", scope: "chat", keys: "Mod+KeyT" },
  { id: "tab.close", label: "SHORTCUT_TAB_CLOSE", scope: "chat", keys: "Mod+KeyW" },
  { id: "tab.next", label: "SHORTCUT_TAB_NEXT", scope: "chat", keys: "Ctrl+Tab" },
  { id: "tab.previous", label: "SHORTCUT_TAB_PREVIOUS", scope: "chat", keys: "Ctrl+Shift+Tab" },
  { id: "tab.moveNext", label: "SHORTCUT_TAB_MOVE_NEXT", scope: "chat", keys: "Alt+ArrowRight" },
  { id: "tab.movePrevious", label: "SHORTCUT_TAB_MOVE_PREVIOUS", scope: "chat", keys: "Alt+ArrowLeft" },
  { id: "panel.left", label: "PANEL_LEFT", scope: "chat", keys: "Mod+KeyB" },
  { id: "panel.right", label: "PANEL_RIGHT", scope: "chat", keys: "" },
  { id: "terminal.tab.new", label: "SHORTCUT_TERMINAL_TAB_NEW", scope: "terminal", keys: "Mod+KeyT" },
  { id: "terminal.tab.close", label: "SHORTCUT_TERMINAL_TAB_CLOSE", scope: "terminal", keys: "Mod+KeyW" },
  { id: "terminal.tab.next", label: "SHORTCUT_TERMINAL_TAB_NEXT", scope: "terminal", keys: "Ctrl+Tab" },
  { id: "terminal.tab.previous", label: "SHORTCUT_TERMINAL_TAB_PREVIOUS", scope: "terminal", keys: "Ctrl+Shift+Tab" },
  { id: "files.copy", label: "SHORTCUT_FILES_COPY", scope: "files", keys: "Mod+KeyC" },
  { id: "files.cut", label: "SHORTCUT_FILES_CUT", scope: "files", keys: "Mod+KeyX" },
  { id: "files.paste", label: "SHORTCUT_FILES_PASTE", scope: "files", keys: "Mod+KeyV" },
  { id: "files.delete", label: "SHORTCUT_FILES_DELETE", scope: "files", keys: "Delete", mac: "Meta+Backspace" },
  {
    id: "window.fullscreen",
    label: "SHORTCUT_WINDOW_FULLSCREEN",
    scope: "global",
    keys: "F11",
    mac: "Ctrl+Meta+KeyF",
    web: "",
  },
  { id: "window.refresh", label: "REFRESH", scope: "global", keys: "Mod+KeyR", web: "" },
  { id: "window.commands", label: "COMMANDS", scope: "global", keys: "Mod+KeyK" },
];

const BY_ID = new Map(SHORTCUTS.map((shortcut) => [shortcut.id, shortcut]));

export type ShortcutKeys = Record<string, string>;

const MOD = MAC ? "Meta" : "Ctrl";
const MODIFIER_ORDER = ["Ctrl", "Alt", "Shift", "Meta"];

const normalize = (keys: string): string => {
  if (!keys) return "";
  const parts = keys.split("+");
  const code = parts.pop() ?? "";
  const held = parts.map((part) => (part === "Mod" ? MOD : part));
  return [...MODIFIER_ORDER.filter((modifier) => held.includes(modifier)), code].join("+");
};

export const defaultKeys = (id: string): string => {
  const shortcut = BY_ID.get(id);
  if (!shortcut) return "";
  if (!isTauri && shortcut.web !== undefined) return normalize(shortcut.web);
  if (MAC && shortcut.mac !== undefined) return normalize(shortcut.mac);
  return normalize(shortcut.keys);
};

export const keysIn = (id: string, custom: ShortcutKeys): string =>
  custom[id] === undefined ? defaultKeys(id) : normalize(custom[id]);

export const signature = (event: KeyboardEvent): string =>
  [
    ...(event.ctrlKey ? ["Ctrl"] : []),
    ...(event.altKey ? ["Alt"] : []),
    ...(event.shiftKey ? ["Shift"] : []),
    ...(event.metaKey ? ["Meta"] : []),
    event.code,
  ].join("+");

const keyLabel = (code: string): string => {
  if (NAMED_KEYS[code]) return NAMED_KEYS[code];
  if (code.startsWith("Key")) return code.slice(3);
  if (code.startsWith("Digit")) return code.slice(5);
  if (code.startsWith("Numpad")) return code.slice(6);
  return code;
};

const THIN_SPACE = " ";

const META_LABEL = platformName() === "linux" ? "Super" : "Win";

const MODIFIER_LABELS: Record<string, string> = MAC
  ? { Ctrl: "⌃", Alt: "⌥", Shift: "⇧", Meta: "⌘" }
  : { Ctrl: "Ctrl", Alt: "Alt", Shift: "⇧", Meta: META_LABEL };

export const describe = (keys: string): string => {
  const parts = keys.split("+");
  const code = parts.pop() ?? "";
  return [...parts.map((part) => MODIFIER_LABELS[part] ?? part), keyLabel(code)].join(THIN_SPACE);
};

const ariaKey = (code: string): string => {
  if (code.startsWith("Key")) return code.slice(3);
  if (code.startsWith("Digit")) return code.slice(5);
  if (code.startsWith("Numpad")) return code.slice(6);
  return code;
};

const ariaKeys = (keys: string): string => {
  const parts = keys.split("+");
  const code = parts.pop() ?? "";
  return [...parts.map((part) => (part === "Ctrl" ? "Control" : part)), ariaKey(code)].join("+");
};

type Handler = () => boolean | void;

class Shortcuts {
  #custom = $state<ShortcutKeys>(store.get<ShortcutKeys>(CUSTOM_KEY, {}));
  #handlers = new Map<string, Handler[]>();

  get custom() {
    return this.#custom;
  }

  register(id: string, handler: Handler): () => void {
    const claimed = this.#handlers.get(id) ?? [];
    claimed.push(handler);
    this.#handlers.set(id, claimed);
    return () => {
      const current = this.#handlers.get(id);
      if (!current) return;
      const index = current.lastIndexOf(handler);
      if (index >= 0) current.splice(index, 1);
      if (!current.length) this.#handlers.delete(id);
    };
  }

  handle(event: KeyboardEvent, scopes: ShortcutScope[]): boolean {
    return this.run(this.idFor(signature(event), scopes));
  }

  run(id: string | null): boolean {
    const handler = id ? this.#handlers.get(id)?.at(-1) : null;
    return handler ? handler() !== false : false;
  }

  available(scopes: ShortcutScope[]): ShortcutDef[] {
    return SHORTCUTS.filter(
      (shortcut) => scopes.includes(shortcut.scope) && this.#handlers.has(shortcut.id),
    );
  }

  keys(id: string): string {
    return keysIn(id, this.#custom);
  }

  hint(id: string): string {
    if (isTouch) return "";
    const keys = this.keys(id);
    return keys ? describe(keys) : "";
  }

  aria(id: string): string | undefined {
    const keys = this.keys(id);
    return keys ? ariaKeys(keys) : undefined;
  }

  idFor(keys: string, scopes: ShortcutScope[]): string | null {
    for (const scope of scopes) {
      const match = SHORTCUTS.find(
        (shortcut) => shortcut.scope === scope && this.keys(shortcut.id) === keys,
      );
      if (match) return match.id;
    }
    return null;
  }

  set(id: string, keys: string) {
    this.replace({ ...this.#custom, [id]: keys });
  }

  replace(custom: ShortcutKeys) {
    this.#custom = custom;
    store.set(CUSTOM_KEY, this.#custom);
  }
}

export const conflicts = (id: string, keys: string, custom: ShortcutKeys): ShortcutDef[] => {
  const scope = BY_ID.get(id)?.scope;
  return SHORTCUTS.filter(
    (shortcut) =>
      shortcut.id !== id &&
      keysIn(shortcut.id, custom) === keys &&
      (shortcut.scope === scope || shortcut.scope === "global" || scope === "global"),
  );
};

export const shortcuts = new Shortcuts();
