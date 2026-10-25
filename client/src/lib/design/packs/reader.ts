import type { BackgroundEffects } from "../backgrounds";
import { traitsOf } from "./fontTraits";
import type {
  Pack,
  PackAccent,
  PackBackground,
  PackFont,
  PackInfo,
  PackSyntax,
  PackTerminal,
  ThemeFile,
} from "./model";
import {
  BACKGROUND_FITS,
  BUILTIN_PACK_IDS,
  COLOR_KEYS,
  EFFECT_RANGES,
  FONT_FORMATS,
  FONT_KINDS,
  IMAGE_FORMATS,
  MANIFEST,
  PACK_SCHEMA,
  TERMINAL_KEYS,
  THEME_KINDS,
  type BackgroundEffect,
  type BackgroundFit,
  type FontKind,
  type ThemeKind,
} from "./schema";

export type PackErrorCode =
  | "archive"
  | "manifest"
  | "json"
  | "schema"
  | "field"
  | "color"
  | "key"
  | "reference"
  | "cycle"
  | "size"
  | "format"
  | "reserved"
  | "duplicate"
  | "empty";

export class PackError extends Error {
  readonly args: string[];

  constructor(
    readonly code: PackErrorCode,
    ...args: string[]
  ) {
    super([code, ...args].join(": "));
    this.args = args;
  }
}

export interface PackSource {
  paths: readonly string[];
  json(path: string): unknown;
  bytes(path: string): Uint8Array | undefined;
}

export interface KnownIds {
  themes: ReadonlySet<string>;
  syntax: ReadonlySet<string>;
}

type Fields = Record<string, unknown>;

type Entry = [path: string, local: string];

const COLOR = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const LOCAL_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const FONT_STYLE = /^[a-z ]*$/i;
const MANIFEST_FIELDS = ["schema", "id", "name", "version", "author", "contributors", "description", "preview"];
const THEME_FIELDS = ["name", "kind", "extends", "accent", "syntax", "colors"];
const TERMINAL_FIELDS = ["name", "colors"];
const ACCENT_FIELDS = ["id", "name", "color"];
const ACCENTS_FILE = "accents.json";

export const slugOf = (name: string): string =>
  name
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export const extensionOf = (path: string): string => path.slice(path.lastIndexOf(".") + 1).toLowerCase();

const baseOf = (path: string): string => {
  const name = path.slice(path.lastIndexOf("/") + 1);
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(0, dot) : name;
};

const isFields = (value: unknown): value is Fields =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const fieldsAt = (source: PackSource, path: string): Fields => {
  const value = source.json(path);
  if (!isFields(value)) throw new PackError("json", path);
  return value;
};

const onlyFields = (fields: Fields, allowed: readonly string[], path: string) => {
  const unknown = Object.keys(fields).find((key) => !allowed.includes(key));
  if (unknown !== undefined) throw new PackError("key", path, unknown);
};

const textOf = (fields: Fields, key: string, path: string): string | null => {
  const value = fields[key];
  if (value === undefined) return null;
  if (typeof value !== "string" || !value.trim()) throw new PackError("field", path, key);
  return value.trim();
};

const requiredText = (fields: Fields, key: string, path: string): string => {
  const value = textOf(fields, key, path);
  if (value === null) throw new PackError("field", path, key);
  return value;
};

const colorOf = (value: unknown, path: string, key: string): string => {
  if (typeof value !== "string" || !COLOR.test(value)) throw new PackError("color", path, key, String(value));
  return value.toLowerCase();
};

const colorsOf = (fields: Fields, keys: readonly string[], path: string): Record<string, string> => {
  const raw = fields.colors;
  if (raw === undefined) return {};
  if (!isFields(raw)) throw new PackError("field", path, "colors");
  return Object.fromEntries(
    Object.entries(raw).map(([key, value]) => {
      if (!keys.includes(key)) throw new PackError("key", path, `colors.${key}`);
      return [key, colorOf(value, path, `colors.${key}`)];
    }),
  );
};

const readInfo = (source: PackSource): PackInfo => {
  if (!source.paths.includes(MANIFEST)) throw new PackError("manifest", MANIFEST);
  const fields = fieldsAt(source, MANIFEST);
  onlyFields(fields, MANIFEST_FIELDS, MANIFEST);
  const schema = fields.schema;
  if (typeof schema !== "number" || !Number.isInteger(schema)) throw new PackError("field", MANIFEST, "schema");
  if (schema > PACK_SCHEMA) throw new PackError("schema", String(schema));
  const name = requiredText(fields, "name", MANIFEST);
  const id = textOf(fields, "id", MANIFEST) ?? slugOf(name);
  if (!LOCAL_ID.test(id)) throw new PackError("field", MANIFEST, "id");
  const contributors = fields.contributors ?? [];
  if (!Array.isArray(contributors) || contributors.some((entry) => typeof entry !== "string" || !entry.trim())) {
    throw new PackError("field", MANIFEST, "contributors");
  }
  const preview = textOf(fields, "preview", MANIFEST);
  if (preview !== null && !source.paths.includes(preview)) throw new PackError("reference", MANIFEST, "preview", preview);
  if (preview !== null && !IMAGE_FORMATS.includes(extensionOf(preview))) throw new PackError("format", preview);
  return {
    id,
    name,
    version: requiredText(fields, "version", MANIFEST),
    author: textOf(fields, "author", MANIFEST),
    contributors: (contributors as string[]).map((entry) => entry.trim()),
    description: textOf(fields, "description", MANIFEST),
    preview,
  };
};

const entriesIn = (source: PackSource, folder: string): Entry[] => {
  const seen = new Set<string>();
  return source.paths
    .filter((path) => path.startsWith(`${folder}/`) && !path.endsWith("/"))
    .map((path) => {
      const local = slugOf(baseOf(path));
      if (path.split("/").length !== 2 || extensionOf(path) !== "json" || !local) throw new PackError("format", path);
      if (seen.has(local)) throw new PackError("duplicate", path);
      seen.add(local);
      return [path, local];
    });
};

const BACKGROUND_FIELDS = ["name", "fit", ...Object.keys(EFFECT_RANGES)];

const effectsOf = (fields: Fields, path: string): Partial<BackgroundEffects> => {
  const effects: Partial<BackgroundEffects> = {};
  for (const [key, range] of Object.entries(EFFECT_RANGES)) {
    const value = fields[key];
    if (value === undefined) continue;
    if (typeof value !== "number" || !(value >= range.min && value <= range.max)) throw new PackError("field", path, key);
    effects[key as BackgroundEffect] = value;
  }
  if (fields.fit !== undefined) {
    if (!BACKGROUND_FITS.includes(fields.fit as BackgroundFit)) throw new PackError("field", path, "fit");
    effects.fit = fields.fit as BackgroundFit;
  }
  return effects;
};

const readBackgrounds = (source: PackSource, pack: string, qualify: (local: string) => string): PackBackground[] => {
  const images = new Map<string, string>();
  const settings = new Map<string, string>();
  for (const path of source.paths.filter((item) => item.startsWith("backgrounds/"))) {
    const local = slugOf(baseOf(path));
    const extension = extensionOf(path);
    const known = extension === "json" || IMAGE_FORMATS.includes(extension);
    if (path.split("/").length !== 2 || !local || !known) throw new PackError("format", path);
    const target = extension === "json" ? settings : images;
    if (target.has(local)) throw new PackError("duplicate", path);
    target.set(local, path);
  }
  for (const [local, path] of settings) {
    if (!images.has(local)) throw new PackError("reference", path, "backgrounds", local);
  }
  return [...images].map(([local, file]) => {
    const path = settings.get(local);
    const fields = path ? fieldsAt(source, path) : {};
    if (path) onlyFields(fields, BACKGROUND_FIELDS, path);
    return {
      id: qualify(local),
      pack,
      name: (path ? textOf(fields, "name", path) : null) ?? baseOf(file),
      file,
      effects: path ? effectsOf(fields, path) : {},
    };
  });
};

const FONT_DEPTH = 4;

const readFonts = (source: PackSource, pack: string, qualify: (local: string) => string): PackFont[] => {
  const fonts = new Map<string, PackFont>();
  for (const path of source.paths.filter((item) => item.startsWith("fonts/"))) {
    const [, kind, family, file] = path.split("/");
    const local = slugOf(family ?? "");
    const valid = path.split("/").length === FONT_DEPTH && FONT_KINDS.includes(kind as FontKind) && local && file;
    if (!valid || !FONT_FORMATS.includes(extensionOf(path))) throw new PackError("format", path);
    const key = `${kind}/${local}`;
    const known = fonts.get(key);
    if (known && known.name !== family) throw new PackError("duplicate", path);
    const face = `cc-${pack}-${kind}-${local}`;
    const font = known ?? {
      id: qualify(local),
      pack,
      kind: kind as FontKind,
      name: family,
      family: `"${face}"`,
      face,
      files: [],
    };
    font.files.push({ file: path, ...traitsOf(source.bytes(path) ?? new Uint8Array(), path) });
    fonts.set(key, font);
  }
  return [...fonts.values()];
};

const syntaxColors = (value: unknown, path: string, key: string) => {
  if (!isFields(value)) return;
  for (const [field, entry] of Object.entries(value)) {
    if (field === "fontStyle") {
      if (typeof entry !== "string" || !FONT_STYLE.test(entry)) throw new PackError("field", path, `${key}.${field}`);
    } else if (typeof entry === "string") colorOf(entry, path, `${key}.${field}`);
  }
};

export const readPack = (source: PackSource, builtin: boolean, known: KnownIds): Pack => {
  const info = readInfo(source);
  if (!builtin && BUILTIN_PACK_IDS.includes(info.id)) throw new PackError("reserved", info.id);
  const pack = info.id;
  const qualify = (local: string) => (builtin ? local : `${pack}/${local}`);
  const themeEntries = entriesIn(source, "themes");
  const syntaxEntries = entriesIn(source, "syntax");
  const ownThemes = new Set(themeEntries.map(([, local]) => local));
  const ownSyntax = new Set(syntaxEntries.map(([, local]) => local));

  const reference = (path: string, field: string, local: string, own: Set<string>, global: ReadonlySet<string>) => {
    if (own.has(local)) return qualify(local);
    if (global.has(local)) return local;
    throw new PackError("reference", path, field, local);
  };

  const themes = themeEntries.map(([path, local]): [string, ThemeFile] => {
    const fields = fieldsAt(source, path);
    onlyFields(fields, THEME_FIELDS, path);
    const kind = requiredText(fields, "kind", path);
    if (!THEME_KINDS.includes(kind as ThemeKind)) throw new PackError("field", path, "kind");
    const parent = textOf(fields, "extends", path);
    const syntax = textOf(fields, "syntax", path);
    return [
      path,
      {
        id: qualify(local),
        pack,
        name: requiredText(fields, "name", path),
        kind: kind as ThemeKind,
        extends: parent === null ? null : reference(path, "extends", parent, ownThemes, known.themes),
        accent: fields.accent === undefined ? null : colorOf(fields.accent, path, "accent"),
        syntax: syntax === null ? null : reference(path, "syntax", syntax, ownSyntax, known.syntax),
        colors: colorsOf(fields, COLOR_KEYS, path),
      },
    ];
  });

  const parents = new Map(themes.map(([, theme]) => [theme.id, theme.extends]));
  for (const [path, theme] of themes) {
    const trail = new Set<string>();
    for (let id: string | null | undefined = theme.id; id && parents.has(id); id = parents.get(id)) {
      if (trail.has(id)) throw new PackError("cycle", path);
      trail.add(id);
    }
  }

  const terminals = entriesIn(source, "terminal").map(([path, local]): PackTerminal => {
    const fields = fieldsAt(source, path);
    onlyFields(fields, TERMINAL_FIELDS, path);
    return { id: qualify(local), pack, name: requiredText(fields, "name", path), colors: colorsOf(fields, TERMINAL_KEYS, path) };
  });

  const syntax = syntaxEntries.map(([path, local]): PackSyntax => {
    const fields = fieldsAt(source, path);
    const rules = fields.tokenColors ?? fields.settings;
    if (!Array.isArray(rules)) throw new PackError("field", path, "tokenColors");
    syntaxColors(fields.colors, path, "colors");
    rules.forEach((rule, index) => syntaxColors(isFields(rule) ? rule.settings : null, path, `tokenColors.${index}`));
    return { id: qualify(local), pack, name: textOf(fields, "name", path) ?? local, file: path };
  });

  const accentIds = new Set<string>();
  const accentEntries = source.paths.includes(ACCENTS_FILE) ? source.json(ACCENTS_FILE) : [];
  if (!Array.isArray(accentEntries)) throw new PackError("json", ACCENTS_FILE);
  const accents = accentEntries.map((entry, index): PackAccent => {
    const path = `${ACCENTS_FILE}[${index}]`;
    if (!isFields(entry)) throw new PackError("json", path);
    onlyFields(entry, ACCENT_FIELDS, path);
    const name = requiredText(entry, "name", path);
    const local = textOf(entry, "id", path) ?? slugOf(name);
    if (!LOCAL_ID.test(local)) throw new PackError("field", path, "id");
    if (accentIds.has(local)) throw new PackError("duplicate", path);
    accentIds.add(local);
    return { id: qualify(local), pack, name, color: colorOf(entry.color, path, "color") };
  });

  const result: Pack = {
    info,
    builtin,
    themes: themes.map(([, theme]) => theme),
    terminals,
    accents,
    syntax,
    fonts: readFonts(source, pack, qualify),
    backgrounds: readBackgrounds(source, pack, qualify),
  };
  const contents = [result.themes, result.terminals, result.accents, result.syntax, result.fonts, result.backgrounds];
  if (!builtin && contents.every((items) => !items.length)) {
    throw new PackError("empty");
  }
  return result;
};
