import { accentAt, DEFAULT_ACCENT_INDEX } from "./accents";
import { store } from "$lib/platform/storage";

export type ThemeMode = "system" | "light" | "dark";
export type FontStyle = "flat" | "color" | "system";

const prefersDark = () => window.matchMedia("(prefers-color-scheme: dark)");

const contrastOn = (hex: string): string => {
  const value = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16) / 255);
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.55 ? "#000000" : "#ffffff";
};

class Theme {
  mode = $state<ThemeMode>(store.get("theme.mode", "system"));
  accentIndex = $state<number>(store.get("theme.accent", DEFAULT_ACCENT_INDEX));
  fontStyle = $state<FontStyle>(store.get("theme.font", "flat"));
  systemDark = $state(false);

  readonly dark = $derived(this.mode === "system" ? this.systemDark : this.mode === "dark");
  readonly accent = $derived(accentAt(this.accentIndex));

  start() {
    const media = prefersDark();
    this.systemDark = media.matches;
    media.addEventListener("change", (event) => (this.systemDark = event.matches));

    $effect(() => {
      const root = document.documentElement;
      root.dataset.theme = this.dark ? "dark" : "light";
      root.style.setProperty("--c-accent", this.accent);
      root.style.setProperty("--c-on-accent", contrastOn(this.accent));
      root.dataset.font = this.fontStyle;
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

  setFontStyle(style: FontStyle) {
    this.fontStyle = style;
    store.set("theme.font", style);
  }
}

export const theme = new Theme();
