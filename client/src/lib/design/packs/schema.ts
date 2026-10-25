import builtin from "../../../../../backend/core/packs/builtin.json";
import schema from "../../../../../backend/core/packs/schema.json";

export type ThemeKind = "light" | "dark";

export type FontKind = "text" | "mono" | "symbols" | "emoji";

export interface DerivedColor {
  from: string;
  alpha: number;
}

export interface EffectRange {
  min: number;
  max: number;
}

export type BackgroundFit = "cover" | "contain";

export type BackgroundEffect = "opacity" | "brightness" | "blur" | "saturation" | "x" | "y";

export const PACK_SCHEMA: number = schema.schema;

export const THEME_KINDS = schema.themeKinds as readonly ThemeKind[];

export const COLOR_KEYS: readonly string[] = schema.colors;

export const DERIVED_COLORS: Readonly<Record<string, DerivedColor>> = schema.derived;

export const TERMINAL_KEYS: readonly string[] = schema.terminal;

export const FONT_KINDS = schema.fontKinds as readonly FontKind[];

export const EFFECT_RANGES = schema.backgroundEffects as Readonly<Record<BackgroundEffect, EffectRange>>;

export const BACKGROUND_FITS = schema.backgroundFits as readonly BackgroundFit[];

export const FONT_FORMATS: readonly string[] = schema.fontFormats;

export const IMAGE_FORMATS: readonly string[] = schema.imageFormats;

export const MAX_FILE_BYTES: number = schema.maxFileBytes;

export const MAX_PACK_BYTES: number = schema.maxPackBytes;

export const BUILTIN_PACK_IDS: readonly string[] = builtin;

export const MANIFEST: string = schema.manifest;

export const PACK_EXTENSION: string = schema.extension;

export const PACK_MIME: string = schema.mime;

export const isPackFile = (name: string): boolean => name.toLowerCase().endsWith(PACK_EXTENSION);
