import "@fontsource-variable/geist";
import "@fontsource-variable/geist-mono";
import "@fontsource-variable/ibm-plex-sans";
import "@fontsource-variable/inter";
import "@fontsource-variable/jetbrains-mono";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/700.css";
import type { FontKind } from "./packs/schema";

export const SYSTEM_FONT = "system";

export interface BuiltinFont {
  id: string;
  name: string | null;
  family: string;
}

export const BUILTIN_FONTS: Record<FontKind, readonly BuiltinFont[]> = {
  text: [
    { id: "geist", name: "Geist Sans", family: '"Geist Variable"' },
    { id: "plex", name: "IBM Plex Sans", family: '"IBM Plex Sans Variable"' },
    { id: "inter", name: "Inter", family: '"Inter Variable"' },
  ],
  mono: [
    { id: "geist", name: "Geist Mono", family: '"Geist Mono Variable"' },
    { id: "plex", name: "IBM Plex Mono", family: '"IBM Plex Mono"' },
    { id: "jetbrains", name: "JetBrains Mono", family: '"JetBrains Mono Variable"' },
  ],
  symbols: [{ id: "dejavu", name: "DejaVu Sans", family: '"DejaVu Sans"' }],
  emoji: [
    { id: "flat", name: "Fluent Emoji Flat", family: '"Fluent Emoji Flat"' },
    { id: "color", name: "Fluent Emoji Color", family: '"Fluent Emoji Color"' },
  ],
};

export const SYSTEM_FAMILIES: Record<FontKind, string> = {
  text: "system-ui",
  mono: "ui-monospace, monospace",
  symbols: '"Segoe UI Symbol", "Apple Symbols"',
  emoji: '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji"',
};

export const DEFAULT_FONTS: Record<FontKind, string> = { text: "geist", mono: "geist", symbols: "dejavu", emoji: SYSTEM_FONT };

export const FONT_SAMPLES: Record<FontKind, string> = { text: "Aa", mono: "Aa", symbols: "✓✂⏎", emoji: "😃" };

export const SAMPLED_FONT_KINDS: ReadonlySet<FontKind> = new Set(["symbols", "emoji"]);
