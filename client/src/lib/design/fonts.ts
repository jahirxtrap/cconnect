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
    { id: SYSTEM_FONT, name: null, family: "system-ui" },
  ],
  mono: [
    { id: "geist", name: "Geist Mono", family: '"Geist Mono Variable"' },
    { id: "plex", name: "IBM Plex Mono", family: '"IBM Plex Mono"' },
    { id: "jetbrains", name: "JetBrains Mono", family: '"JetBrains Mono Variable"' },
    { id: SYSTEM_FONT, name: null, family: "ui-monospace, monospace" },
  ],
  symbols: [
    { id: "dejavu", name: "DejaVu Sans", family: '"DejaVu Sans"' },
    { id: SYSTEM_FONT, name: null, family: '"Segoe UI Symbol", "Apple Symbols"' },
  ],
  emoji: [
    { id: SYSTEM_FONT, name: null, family: '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji"' },
    { id: "flat", name: "Fluent Emoji Flat", family: '"Fluent Emoji Flat"' },
    { id: "color", name: "Fluent Emoji Color", family: '"Fluent Emoji Color"' },
  ],
};

export const DEFAULT_FONTS: Record<FontKind, string> = { text: "geist", mono: "geist", symbols: "dejavu", emoji: SYSTEM_FONT };

export const FONT_SAMPLES: Record<FontKind, string> = { text: "Aa", mono: "Aa", symbols: "✓✂⏎", emoji: "😃" };

export const SAMPLED_FONT_KINDS: ReadonlySet<FontKind> = new Set(["symbols", "emoji"]);
