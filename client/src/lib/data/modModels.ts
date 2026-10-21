export const MOD_COMPONENTS = [
  "Pane",
  "AbovePrompt",
  "SessionMode",
  "PromptHint",
  "Spinner",
  "UserMessage",
  "AssistantMessage",
  "ToolUse",
  "ToolResult",
  "ToolGroup",
  "CommandOutput",
  "AskUserQuestion",
] as const;

export type ModComponent = (typeof MOD_COMPONENTS)[number];

export type ModAction =
  | "press"
  | "input"
  | "select"
  | "close"
  | "show"
  | "focus"
  | "site_focus"
  | "site_scroll"
  | "client_press"
  | "client_message"
  | "client_fault"
  | "prompt_edit"
  | "prompt_autocomplete";

export interface ModCompletionRow {
  text: string;
  label: string;
  description: string;
}

export interface ModCompletions {
  start: number;
  end: number;
  rows: ModCompletionRow[];
}

export interface ModStroke {
  key: string;
  ctrl?: true;
  shift?: true;
  meta?: true;
}

export interface ModDecoration {
  start: number;
  end: number;
  style: Record<string, unknown>;
}

export interface ModPromptBox {
  text: string;
  cursor: number;
  decorations: ModDecoration[];
  superseded?: true;
}

export interface ModPress {
  plugin: string;
  handle: number | string;
}

export interface ModNode {
  type: string;
  props: Record<string, unknown>;
  hover: Record<string, unknown> | null;
  children: ModChild[];
  press: ModPress | null;
  owner: string | null;
  client: string | null;
}

export interface ModRenderSite {
  component: ModComponent;
  instanceId: string;
  props: Record<string, unknown>;
  columns: number;
  rows: number;
  offset: number;
}

export interface ModDrawn {
  tree: ModNode | null;
  props: Record<string, unknown> | null;
  hooked: boolean;
  clientModules: Record<string, string>;
}

export interface ModCommand {
  name: string;
  description: string;
  argumentHint: string;
  plugin: string;
}

export interface ModClientEvent {
  type: "press" | "input" | "select";
  kind?: "change" | "submit";
  value?: string;
}

export interface ModElement {
  plugin: string;
  key: string;
}

export interface ModKeyed extends ModElement {
  top: number;
  bottom: number;
}

export type ModChild = ModNode | string;

const SHELLS = new Set(["Box", "Text"]);

export const isEmptyTree = (node: ModChild): boolean => {
  if (typeof node === "string") return node.trim() === "";
  if (!SHELLS.has(node.type) || node.props.borderStyle || node.props.backgroundColor) return false;
  return node.children.every(isEmptyTree);
};

export interface ModPane {
  id: string;
  title: string;
  plugin: string | null;
  closeOnEscape: boolean;
  columns: number | null;
}

export interface ModStatus {
  plugin: string;
  text: string;
}

export interface ModState {
  surface: boolean;
  panes: ModPane[];
  shownId: string | null;
  focusedId: string | null;
  focusRequestedId: string | null;
  status: ModStatus[];
  commands: ModCommand[];
}

export type ModRequestKind = "prompt_fill" | "prompt_suggest" | "prompt_read" | "copy" | "selection";

export type ModFillMode = "replace" | "append" | "insert";

export interface ModRequest {
  id: string;
  kind: ModRequestKind;
  text: string;
  mode: ModFillMode;
}

export interface ModSiteTarget {
  component: ModComponent;
  instanceId: string;
}

export interface ModFocus extends ModSiteTarget, ModElement {
  seq: number;
}

export interface ModScroll extends ModSiteTarget {
  offset: number;
  followEnd: boolean;
  seq: number;
}

export interface ModToast {
  id: number;
  plugin: string | null;
  text: string;
}

export interface ModActionFields {
  plugin?: string;
  handle?: number | string;
  key?: string;
  href?: string;
  kind?: "change" | "submit";
  value?: string;
  id?: string | null;
  component?: ModComponent;
  instance_id?: string;
  client?: string;
  module?: string;
  event?: ModClientEvent;
  data?: unknown;
  phase?: "load" | "render" | "run";
  reason?: string;
  is_held?: boolean;
  element?: ModElement | string | null;
  by?: number | "person" | "auto" | "app";
  offset?: number;
  body_rows?: number;
  content_rows?: number;
  keyed?: ModKeyed[];
  text?: string;
  cursor?: number;
  stroke?: ModStroke;
}

type Wire = Record<string, unknown>;

const record = (value: unknown): Wire | null =>
  value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Wire) : null;

const string = (raw: Wire, key: string): string | null => (typeof raw[key] === "string" ? (raw[key] as string) : null);

export const emptyModState = (): ModState => ({
  surface: false,
  panes: [],
  shownId: null,
  focusedId: null,
  focusRequestedId: null,
  status: [],
  commands: [],
});

const REQUEST_KINDS: ModRequestKind[] = ["prompt_fill", "prompt_suggest", "prompt_read", "copy", "selection"];
const FILL_MODES: ModFillMode[] = ["replace", "append", "insert"];

export const toModComponent = (value: unknown): ModComponent =>
  MOD_COMPONENTS.find((component) => component === value) ?? "Pane";

export const toModRequest = (raw: Wire): ModRequest | null => {
  const id = string(raw, "id");
  const kind = REQUEST_KINDS.find((item) => item === raw.kind);
  if (!id || !kind) return null;
  const mode = FILL_MODES.find((item) => item === raw.mode) ?? "replace";
  return { id, kind, text: string(raw, "text") ?? "", mode };
};

const KEY_NAMES: Record<string, string> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  PageUp: "pageup",
  PageDown: "pagedown",
  Home: "home",
  End: "end",
  Enter: "return",
  Tab: "tab",
  Backspace: "backspace",
  Delete: "delete",
  " ": "space",
};

export const strokeOf = (event: KeyboardEvent): ModStroke | null => {
  const key = KEY_NAMES[event.key] ?? (event.key.length === 1 ? event.key : null);
  if (!key) return null;
  return {
    key,
    ...(event.ctrlKey && { ctrl: true as const }),
    ...(event.shiftKey && { shift: true as const }),
    ...(event.metaKey && { meta: true as const }),
  };
};

export const toModCompletions = (raw: unknown, end: number): ModCompletions | null => {
  const wire = record(raw);
  if (!wire || wire.superseded === true || typeof wire.start !== "number" || !Array.isArray(wire.suggestions)) return null;
  const rows = wire.suggestions.flatMap((item): ModCompletionRow[] => {
    const row = record(item);
    const text = row ? string(row, "text") : null;
    return row && text ? [{ text, label: string(row, "label") ?? text, description: string(row, "description") ?? "" }] : [];
  });
  return rows.length ? { start: wire.start, end, rows } : null;
};

const toDecorations = (raw: unknown, length: number): ModDecoration[] =>
  (Array.isArray(raw) ? raw : [])
    .flatMap((item): ModDecoration[] => {
      const wire = record(item);
      if (!wire || typeof wire.start !== "number" || typeof wire.end !== "number") return [];
      const start = Math.max(0, Math.min(length, Math.floor(wire.start)));
      const end = Math.max(start, Math.min(length, Math.floor(wire.end)));
      const { start: _start, end: _end, virtualText: _virtual, ...style } = wire;
      return end > start ? [{ start, end, style }] : [];
    })
    .sort((a, b) => a.start - b.start);

export const toModPromptBox = (raw: unknown): ModPromptBox | null => {
  const wire = record(raw);
  if (!wire || typeof wire.text !== "string" || typeof wire.cursor !== "number") return null;
  return {
    text: wire.text,
    cursor: wire.cursor,
    decorations: toDecorations(wire.decorations, wire.text.length),
    ...(wire.superseded === true && { superseded: true as const }),
  };
};

const toPress = (raw: unknown, held: unknown, owner: string | null): ModPress | null => {
  if (typeof held === "number" && owner) return { plugin: owner, handle: held };
  const wire = record(raw);
  const plugin = wire ? string(wire, "plugin") : null;
  const handle = wire?.handle;
  return plugin && (typeof handle === "number" || typeof handle === "string") ? { plugin, handle } : null;
};

const toChild = (raw: unknown, owner: string | null): ModChild[] => {
  if (typeof raw === "string") return [raw];
  if (typeof raw === "number") return [String(raw)];
  if (Array.isArray(raw)) return raw.flatMap((item) => toChild(item, owner));
  const node = toModNode(raw, owner);
  return node ? [node] : [];
};

export const toModNode = (raw: unknown, inherited: string | null = null): ModNode | null => {
  const wire = record(raw);
  const type = wire ? string(wire, "type") : null;
  if (!wire || !type) return null;
  const part = record(wire.part);
  const owner = (part ? string(part, "plugin") : null) ?? inherited;
  const client = record(wire.client);
  return {
    type,
    props: record(wire.props) ?? {},
    hover: record(wire.hover),
    children: toChild(wire.children, owner),
    press: toPress(wire.press, wire.held, owner),
    owner,
    client: client ? string(client, "plugin") : null,
  };
};

export const toModDrawn = (raw: Wire): ModDrawn => {
  const modules = record(raw.client_modules) ?? {};
  return {
    tree: toModNode(raw.tree),
    props: record(raw.props),
    hooked: raw.hooked === true,
    clientModules: Object.fromEntries(
      Object.entries(modules).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
    ),
  };
};

const toModCommand = (raw: unknown): ModCommand | null => {
  const wire = record(raw);
  const name = wire ? string(wire, "name") : null;
  const plugin = wire ? string(wire, "plugin") : null;
  if (!wire || !name || !plugin) return null;
  return { name, plugin, description: string(wire, "description") ?? "", argumentHint: string(wire, "argument_hint") ?? "" };
};

export const toModState = (raw: Wire): ModState => ({
  surface: raw.surface === true,
  panes: (Array.isArray(raw.panes) ? raw.panes : [])
    .map(record)
    .filter((pane): pane is Wire => pane !== null && !!string(pane, "id"))
    .map((pane) => ({
      id: string(pane, "id") ?? "",
      title: string(pane, "title") ?? string(pane, "id") ?? "",
      plugin: string(pane, "plugin"),
      closeOnEscape: pane.close_on_escape === true,
      columns: typeof pane.columns === "number" && pane.columns > 0 ? pane.columns : null,
    })),
  shownId: string(raw, "shown_id"),
  focusedId: string(raw, "focused_id"),
  focusRequestedId: string(raw, "focus_requested_id"),
  status: (Array.isArray(raw.status) ? raw.status : [])
    .map(record)
    .filter((item): item is Wire => item !== null && !!string(item, "text"))
    .map((item) => ({ plugin: string(item, "plugin") ?? "", text: string(item, "text") ?? "" })),
  commands: (Array.isArray(raw.commands) ? raw.commands : [])
    .map(toModCommand)
    .filter((command): command is ModCommand => command !== null),
});
