import { DEFAULT_VEIL, type VeilLook } from "$lib/design/backgrounds";

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
  "Theme",
] as const;

export type ModComponent = (typeof MOD_COMPONENTS)[number];

export const THEME_LOOK = "theme";

export const THEME_SCENE = "backdrop";

export const themeImageSite = (id: string, index: number): string => `image:${id}:${index}`;

export type ModScheme = "light" | "dark";

export const MOD_SCHEMES: readonly ModScheme[] = ["light", "dark"];

export interface ModLookColors {
  label: string;
  inputs: Partial<Record<ModScheme, Record<string, string>>>;
  codeTheme: Partial<Record<ModScheme, string>>;
  contrast: "more" | null;
}

export type ModGlass = VeilLook;

export interface ModGroundStop {
  at: number | null;
  color: string;
}

export interface ModGroundPath {
  d: string;
  strokeWidth: number | null;
  color: string | null;
}

export type ModGround =
  | { kind: "color"; color: string }
  | { kind: "gradient"; stops: ModGroundStop[]; angle: number; radial: boolean; size: [number, number] | null; repeat: boolean }
  | {
      kind: "vector";
      viewBox: [number, number];
      paths: ModGroundPath[];
      color: string | null;
      size: [number, number] | null;
      repeat: boolean;
    }
  | { kind: "image"; id: string; type: "jpeg" | "png"; width: number; height: number; size: [number, number] | null; repeat: boolean };

export interface ModScene {
  plugin: string;
  name: string;
  source: string;
  alt: string;
  glass: ModGlass | false;
}

export interface ModLook {
  plugin: string;
  colors: ModLookColors | null;
  scheme: ModScheme | null;
  ground: ModGround | null;
  scene: ModScene | null;
}

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

export const toModSiteTargets = (value: unknown): ModSiteTarget[] | null =>
  Array.isArray(value)
    ? value.flatMap((item) => {
        const wire = record(item);
        const component = wire ? MOD_COMPONENTS.find((name) => name === wire.component) : undefined;
        const instanceId = wire ? string(wire, "instance_id") : null;
        return component && instanceId ? [{ component, instanceId }] : [];
      })
    : null;

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
};
export const SPACE_KEY = "space";

export const clientKeyOf = (event: KeyboardEvent): ModStroke | null => {
  const key = KEY_NAMES[event.key] ?? (event.key.length === 1 ? event.key : null);
  if (!key) return null;
  return {
    key,
    ...(event.ctrlKey && { ctrl: true as const }),
    ...(event.shiftKey && { shift: true as const }),
    ...(event.metaKey && { meta: true as const }),
  };
};

export const strokeOf = (event: KeyboardEvent): ModStroke | null => {
  const stroke = clientKeyOf(event);
  return stroke?.key === " " ? { ...stroke, key: SPACE_KEY } : stroke;
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

export const lookSite = (instanceId: string): ModRenderSite => ({
  component: "Theme",
  instanceId,
  props: {},
  columns: 0,
  rows: 0,
  offset: 0,
});

const HEX_COLOR = /^#[0-9a-f]{6}$/i;
const GRADIENT_ANGLE = 180;

const number = (raw: Wire, key: string): number | null => (typeof raw[key] === "number" ? (raw[key] as number) : null);

const pair = (raw: unknown): [number, number] | null =>
  Array.isArray(raw) && raw.length === 2 && raw.every((side) => typeof side === "number" && side > 0)
    ? [raw[0], raw[1]]
    : null;

const toHexes = (raw: unknown): Record<string, string> | null => {
  const wire = record(raw);
  if (!wire) return null;
  const hexes = Object.entries(wire).filter((entry): entry is [string, string] => typeof entry[1] === "string" && HEX_COLOR.test(entry[1]));
  return hexes.length ? Object.fromEntries(hexes) : null;
};

const toScheme = (raw: unknown): ModScheme | null => MOD_SCHEMES.find((scheme) => scheme === raw) ?? null;

const toLookColors = (raw: unknown): ModLookColors | null => {
  const wire = record(raw);
  const inputs = wire ? record(wire.inputs) : null;
  if (!wire || !inputs) return null;
  const modes = MOD_SCHEMES.flatMap((scheme): [ModScheme, Record<string, string>][] => {
    const hexes = toHexes(inputs[scheme]);
    return hexes ? [[scheme, hexes]] : [];
  });
  if (!modes.length) return null;
  const code = record(wire.codeTheme) ?? {};
  return {
    label: string(wire, "label") ?? "",
    inputs: Object.fromEntries(modes),
    codeTheme: Object.fromEntries(MOD_SCHEMES.flatMap((scheme) => (typeof code[scheme] === "string" ? [[scheme, code[scheme]]] : []))),
    contrast: wire.contrast === "more" ? "more" : null,
  };
};

const toStops = (raw: unknown): ModGroundStop[] =>
  Array.isArray(raw)
    ? raw.flatMap((item): ModGroundStop[] => {
        if (typeof item === "string") return item ? [{ at: null, color: item }] : [];
        const wire = record(item);
        const color = wire ? string(wire, "color") : null;
        return wire && color ? [{ at: number(wire, "at"), color }] : [];
      })
    : [];

const toPaths = (raw: unknown): ModGroundPath[] =>
  Array.isArray(raw)
    ? raw.flatMap((item): ModGroundPath[] => {
        if (typeof item === "string") return item ? [{ d: item, strokeWidth: null, color: null }] : [];
        const wire = record(item);
        const d = wire ? string(wire, "d") : null;
        return wire && d ? [{ d, strokeWidth: number(wire, "strokeWidth"), color: string(wire, "color") }] : [];
      })
    : [];

const toGround = (raw: unknown): ModGround | null => {
  const wire = record(raw);
  if (!wire) return null;
  const color = string(wire, "color");
  if (color) return { kind: "color", color };
  const gradient = record(wire.gradient);
  if (gradient) {
    const stops = toStops(gradient.stops);
    if (stops.length < 2) return null;
    return {
      kind: "gradient",
      stops,
      angle: number(gradient, "angle") ?? GRADIENT_ANGLE,
      radial: gradient.shape === "radial",
      size: pair(gradient.size),
      repeat: gradient.repeat === true,
    };
  }
  const vector = record(wire.vector);
  if (vector) {
    const side = number(vector, "viewBox");
    const viewBox = side !== null && side > 0 ? ([side, side] as [number, number]) : pair(vector.viewBox);
    const paths = toPaths(vector.paths);
    if (!viewBox || !paths.length) return null;
    return { kind: "vector", viewBox, paths, color: string(vector, "color"), size: pair(vector.size), repeat: vector.repeat === true };
  }
  const image = record(wire.image);
  if (image) {
    const id = string(image, "id");
    const type = image.type === "jpeg" || image.type === "png" ? image.type : null;
    const width = number(image, "width");
    const height = number(image, "height");
    if (!id || !type || width === null || height === null) return null;
    return { kind: "image", id, type, width, height, size: pair(image.size), repeat: image.repeat === true };
  }
  return null;
};

const toGlass = (raw: unknown): ModGlass | false => {
  if (raw === false) return false;
  const wire = record(raw) ?? {};
  return {
    tint: string(wire, "tint") ?? DEFAULT_VEIL.tint,
    opacity: number(wire, "opacity") ?? DEFAULT_VEIL.opacity,
  };
};

const svgOf = (node: ModChild): ModNode | null => {
  if (typeof node === "string") return null;
  if (node.type === "Svg") return node;
  for (const child of node.children) {
    const found = svgOf(child);
    if (found) return found;
  }
  return null;
};

export const toModLook = (theme: ModDrawn | null, scene: ModDrawn | null): ModLook | null => {
  const own = theme?.props ?? {};
  const drawn = scene?.props ?? {};
  const svg = scene?.tree ? svgOf(scene.tree) : null;
  const source = svg ? string(svg.props, "source") : null;
  const name = string(drawn, "scene");
  const by = string(drawn, "plugin");
  const plugin = string(own, "plugin") ?? by;
  if (!plugin) return null;
  return {
    plugin,
    colors: toLookColors(own.colors),
    scheme: toScheme(own.overrideColorScheme) ?? toScheme(drawn.overrideColorScheme),
    ground: toGround(own.backdrop),
    scene:
      svg && source && name && by
        ? { plugin: by, name, source, alt: string(svg.props, "alt") ?? "", glass: toGlass(drawn.glass) }
        : null,
  };
};

export const toModImagePiece = (drawn: ModDrawn | null): { data: string; index: number; of: number } | null => {
  const props = drawn?.props;
  if (!props || typeof props.data !== "string" || typeof props.index !== "number" || typeof props.of !== "number") return null;
  return { data: props.data, index: props.index, of: props.of };
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
