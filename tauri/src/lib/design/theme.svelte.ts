import { accentAt, DEFAULT_ACCENT_INDEX } from "./accents";
import { isTauri } from "$lib/platform";
import { store } from "$lib/platform/storage";

export type ThemeMode = "system" | "light" | "dark";
export type FontStyle = "flat" | "color" | "system";

const prefersDark = () => window.matchMedia("(prefers-color-scheme: dark)");

class Theme {
  mode = $state<ThemeMode>(store.get("theme.mode", "system"));
  accentIndex = $state<number>(store.get("theme.accent", DEFAULT_ACCENT_INDEX));
  fontStyle = $state<FontStyle>(store.get("theme.font", "flat"));
  dynamicColor = $state<boolean>(store.get("theme.dynamic", false));
  systemDark = $state(false);
  systemAccent = $state<string | null>(null);

  readonly dark = $derived(this.mode === "system" ? this.systemDark : this.mode === "dark");
  readonly accent = $derived(
    this.dynamicColor ? (this.systemAccent ?? accentAt(this.accentIndex)) : accentAt(this.accentIndex),
  );

  start() {
    const media = prefersDark();
    this.systemDark = media.matches;
    media.addEventListener("change", (event) => (this.systemDark = event.matches));
    void this.#loadSystemAccent();

    $effect(() => {
      const root = document.documentElement;
      root.dataset.theme = this.dark ? "dark" : "light";
      root.style.setProperty("--c-accent", this.accent);
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

  setDynamicColor(enabled: boolean) {
    this.dynamicColor = enabled;
    store.set("theme.dynamic", enabled);
  }

  async #loadSystemAccent() {
    if (!isTauri) return;
    const { invoke } = await import("@tauri-apps/api/core");
    this.systemAccent = await invoke<string | null>("system_accent").catch(() => null);
  }

  setFontStyle(style: FontStyle) {
    this.fontStyle = style;
    store.set("theme.font", style);
  }
}

export const theme = new Theme();
