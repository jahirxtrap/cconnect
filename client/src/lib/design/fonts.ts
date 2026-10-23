import "@fontsource-variable/geist";
import "@fontsource-variable/geist-mono";
import "@fontsource-variable/ibm-plex-sans";
import "@fontsource-variable/inter";
import "@fontsource-variable/jetbrains-mono";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/700.css";

export const FONT_KINDS = ["text", "code", "symbols", "emoji"] as const;

export type FontKind = (typeof FONT_KINDS)[number];

export const FONT_FAMILIES: Record<FontKind, Record<string, string>> = {
  text: {
    geist: '"Geist Variable"',
    plex: '"IBM Plex Sans Variable"',
    inter: '"Inter Variable"',
    system: "system-ui",
  },
  code: {
    geist: '"Geist Mono Variable"',
    plex: '"IBM Plex Mono"',
    jetbrains: '"JetBrains Mono Variable"',
    system: "ui-monospace, monospace",
  },
  symbols: {
    dejavu: '"DejaVu Sans"',
    system: '"Segoe UI Symbol", "Apple Symbols"',
  },
  emoji: {
    system: '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji"',
    flat: '"Fluent Emoji Flat"',
    color: '"Fluent Emoji Color"',
  },
};

export const DEFAULT_FONTS: Record<FontKind, string> = { text: "geist", code: "geist", symbols: "dejavu", emoji: "system" };

export const knownFont = (kind: FontKind, value: string | null): value is string =>
  value !== null && Object.hasOwn(FONT_FAMILIES[kind], value);
