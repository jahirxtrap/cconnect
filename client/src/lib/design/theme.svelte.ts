import { untrack } from "svelte";
import { DEFAULT_ACCENT, DYNAMIC_ACCENT, THEME_ACCENT, withAlpha } from "./accents";
import { DEFAULT_FONTS } from "./fonts";
import { legacyAccent } from "./packs/builtin";
import { loadFace } from "./packs/faces";
import { packs } from "./packs/registry.svelte";
import { FONT_KINDS, THEME_KINDS, type FontKind, type ThemeKind } from "./packs/schema";
import { DEFAULT_TERMINAL, DEFAULT_THEMES } from "./themes";
import { isTauri } from "$lib/platform";
import { store } from "$lib/platform/storage";

export type ThemeMode = "system" | "light" | "dark";

export interface ThemePreview {
  kind: ThemeKind;
  theme: string;
  terminal: string;
}

const themeKey = (kind: ThemeKind) => `theme.${kind}`;

const fontKey = (kind: FontKind) => `theme.font_${kind}`;

const ACCENT_KEY = "theme.accent_id";

const TERMINAL_KEY = "theme.terminal";

const LEGACY_FONT_KEYS: Partial<Record<FontKind, string>> = { emoji: "theme.font" };

const storedAccent = (): string =>
  store.get<string | null>(ACCENT_KEY, null) ??
  (store.get("theme.dynamic", false) ? DYNAMIC_ACCENT : legacyAccent(store.get<number | null>("theme.accent", null))) ??
  DEFAULT_ACCENT;

const storedFont = (kind: FontKind): string => {
  const legacy = LEGACY_FONT_KEYS[kind];
  return (
    store.get<string | null>(fontKey(kind), null) ??
    (legacy ? store.get<string | null>(legacy, null) : null) ??
    DEFAULT_FONTS[kind]
  );
};

const prefersDark = () => window.matchMedia("(prefers-color-scheme: dark)");

const ACCENT_ALPHAS = {
  selection: 0.32,
  quote: 0.6,
  soft: 0.14,
  ring: 0.4,
};

const accentProperties = (color: string): [string, string][] => [
  ["--c-accent", color],
  ["--color-accent", color],
  ...Object.entries(ACCENT_ALPHAS).map(([name, alpha]): [string, string] => [`--c-accent-${name}`, withAlpha(color, alpha)]),
];

export const ringVars = (color: string): string => `--c-accent-ring: ${withAlpha(color, ACCENT_ALPHAS.ring)};`;

export const accentVars = (color: string): string =>
  accentProperties(color)
    .map(([name, value]) => `${name}: ${value};`)
    .join("");

const androidSystemBars = () =>
  (window as unknown as { AndroidSystemBars?: { setAppearance: (dark: boolean) => void; accent: () => string } })
    .AndroidSystemBars;

class Theme {
  mode = $state<ThemeMode>(store.get("theme.mode", "system"));
  accentId = $state<string>(storedAccent());
  fonts = $state(Object.fromEntries(FONT_KINDS.map((kind) => [kind, storedFont(kind)])) as Record<FontKind, string>);
  terminalId = $state<string>(store.get(TERMINAL_KEY, DEFAULT_TERMINAL));
  themeIds = $state(
    Object.fromEntries(THEME_KINDS.map((kind) => [kind, store.get(themeKey(kind), DEFAULT_THEMES[kind])])) as Record<
      ThemeKind,
      string
    >,
  );
  systemDark = $state(prefersDark().matches);
  systemAccent = $state<string | null>(null);
  preview = $state<ThemePreview | null>(null);
  painted = $state(0);
  environmentAccent = $state<string | null>(null);

  readonly dark = $derived(this.mode === "system" ? this.systemDark : this.mode === "dark");
  readonly modeKind = $derived<ThemeKind>(this.dark ? "dark" : "light");
  readonly kind = $derived<ThemeKind>(this.preview?.kind ?? this.modeKind);
  readonly current = $derived(packs.themeOf(this.kind, this.preview?.theme ?? this.themeIds[this.kind]));
  readonly terminal = $derived(packs.terminalOf(this.preview?.terminal ?? this.terminalId));
  readonly syntax = $derived(this.current.syntax);

  readonly appAccent = $derived(this.resolve(this.accentId));

  readonly accent = $derived(this.environmentAccent !== null ? this.resolve(this.environmentAccent) : this.appAccent);

  resolve(choice: string): string {
    if (choice === DYNAMIC_ACCENT) return this.systemAccent ?? this.current.accent;
    if (choice === THEME_ACCENT) return this.current.accent;
    return packs.accentOf(choice)?.color ?? this.current.accent;
  }

  paint() {
    const root = document.documentElement;
    root.dataset.theme = this.kind;
    for (const [key, value] of Object.entries(this.current.colors)) root.style.setProperty(`--c-${key}`, value);
    for (const [key, value] of Object.entries(this.terminal.colors)) root.style.setProperty(`--c-terminal-${key}`, value);
    for (const [name, value] of accentProperties(this.accent)) root.style.setProperty(name, value);
    for (const kind of FONT_KINDS) {
      const font = packs.fontOf(kind, this.fonts[kind]);
      void loadFace(font);
      root.style.setProperty(`--family-${kind}`, font.family);
    }
    androidSystemBars()?.setAppearance(this.kind === "dark");
    untrack(() => this.painted++);
  }

  start() {
    prefersDark().addEventListener("change", (event) => (this.systemDark = event.matches));
    this.#publishPixelGrid();
    void this.#loadSystemAccent();
    $effect(() => this.paint());
  }

  setMode(mode: ThemeMode) {
    this.mode = mode;
    store.set("theme.mode", mode);
  }

  setTheme(kind: ThemeKind, id: string) {
    this.themeIds[kind] = id;
    store.set(themeKey(kind), id);
  }

  setTerminal(id: string) {
    this.terminalId = id;
    store.set(TERMINAL_KEY, id);
  }

  setAccent(choice: string) {
    this.accentId = choice;
    store.set(ACCENT_KEY, choice);
  }

  setFont(kind: FontKind, id: string) {
    this.fonts[kind] = id;
    store.set(fontKey(kind), id);
  }

  async #loadSystemAccent() {
    const android = androidSystemBars();
    if (android) {
      this.systemAccent = android.accent() || null;
      return;
    }
    if (!isTauri) return;
    const { invoke } = await import("@tauri-apps/api/core");
    this.systemAccent = await invoke<string | null>("system_accent").catch(() => null);
  }

  #publishPixelGrid() {
    const density = window.devicePixelRatio || 1;
    document.documentElement.style.setProperty("--px-grid", `${1 / density}px`);
    window
      .matchMedia(`(resolution: ${density}dppx)`)
      .addEventListener("change", () => this.#publishPixelGrid(), { once: true });
  }
}

export const theme = new Theme();
