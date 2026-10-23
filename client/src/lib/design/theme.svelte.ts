import { accentAt, DEFAULT_ACCENT_INDEX, withAlpha } from "./accents";
import { DEFAULT_FONTS, FONT_FAMILIES, FONT_KINDS, knownFont, type FontKind } from "./fonts";
import { isTauri } from "$lib/platform";
import { store } from "$lib/platform/storage";

export type ThemeMode = "system" | "light" | "dark";

const fontKey = (kind: FontKind) => `theme.font_${kind}`;

const storedFont = (kind: FontKind): string => {
  const value = store.get<string | null>(fontKey(kind), null);
  return knownFont(kind, value) ? value : DEFAULT_FONTS[kind];
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
  accentIndex = $state<number>(store.get("theme.accent", DEFAULT_ACCENT_INDEX));
  fonts = $state(Object.fromEntries(FONT_KINDS.map((kind) => [kind, storedFont(kind)])) as Record<FontKind, string>);
  dynamicColor = $state<boolean>(store.get("theme.dynamic", false));
  systemDark = $state(false);
  systemAccent = $state<string | null>(null);

  // Set by the active environment: overrides both the picked accent and the system one.
  environmentAccent = $state<number | null>(null);

  readonly dark = $derived(this.mode === "system" ? this.systemDark : this.mode === "dark");

  readonly appAccent = $derived(
    this.dynamicColor ? (this.systemAccent ?? accentAt(this.accentIndex)) : accentAt(this.accentIndex),
  );

  readonly accent = $derived(
    this.environmentAccent !== null ? accentAt(this.environmentAccent) : this.appAccent,
  );

  start() {
    const media = prefersDark();
    this.systemDark = media.matches;
    media.addEventListener("change", (event) => (this.systemDark = event.matches));
    this.#publishPixelGrid();
    void this.#loadSystemAccent();

    $effect(() => {
      const root = document.documentElement;
      root.dataset.theme = this.dark ? "dark" : "light";
      for (const [name, value] of accentProperties(this.accent)) root.style.setProperty(name, value);
      for (const kind of FONT_KINDS) root.style.setProperty(`--family-${kind}`, FONT_FAMILIES[kind][this.fonts[kind]]);
      this.#applySystemBars(this.dark);
    });
  }

  setMode(mode: ThemeMode) {
    this.mode = mode;
    store.set("theme.mode", mode);
  }

  setAccent(index: number) {
    this.accentIndex = index;
    store.set("theme.accent", index);
  }

  setDynamicColor(enabled: boolean) {
    this.dynamicColor = enabled;
    store.set("theme.dynamic", enabled);
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

  #applySystemBars(dark: boolean) {
    androidSystemBars()?.setAppearance(dark);
  }

  #publishPixelGrid() {
    const density = window.devicePixelRatio || 1;
    document.documentElement.style.setProperty("--px-grid", `${1 / density}px`);
    window
      .matchMedia(`(resolution: ${density}dppx)`)
      .addEventListener("change", () => this.#publishPixelGrid(), { once: true });
  }

  setFont(kind: FontKind, value: string) {
    if (!knownFont(kind, value)) return;
    this.fonts[kind] = value;
    store.set(fontKey(kind), value);
  }
}

export const theme = new Theme();
