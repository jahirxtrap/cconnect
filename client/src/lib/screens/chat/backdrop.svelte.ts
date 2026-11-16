import type { ModLook } from "$lib/data/modModels";
import { DEFAULT_GLASS, NO_BACKGROUND, type BackgroundEffects, type GlassLook } from "$lib/design/backgrounds";
import { packs } from "$lib/design/packs/registry.svelte";
import { theme } from "$lib/design/theme.svelte";
import { DEFAULT_THEMES } from "$lib/design/themes";
import { glassRemapStyle, glassStyle, lookScheme, lookStyle } from "$lib/screens/mods/lookColors";
import type { ChatState } from "./state.svelte";

class WindowBackdrop {
  shown = $state(false);
  owner = $state.raw<ChatState | null>(null);
}

export const windowBackdrop = new WindowBackdrop();

export const backdropOf = (look: ModLook | null, modBackground: boolean, current: string): boolean =>
  modBackground ? !!(look?.scene || look?.ground) : current !== NO_BACKGROUND;

export const glassOf = (look: ModLook | null, modBackground: boolean, effects: BackgroundEffects): GlassLook | null => {
  if (!effects.glass) return null;
  if (!modBackground) return DEFAULT_GLASS;
  return look?.scene && look.scene.glass ? look.scene.glass : null;
};

export const lookCssOf = (look: ModLook | null, modBackground: boolean, over: boolean): string => {
  const scheme = lookScheme(look, theme.dark);
  return [
    look ? lookStyle(look, scheme, packs.themeOf(scheme, DEFAULT_THEMES[scheme]).colors) : "",
    look && modBackground && look.scene?.glass ? glassStyle(look.scene.glass) : "",
    over ? glassRemapStyle() : "",
  ]
    .filter(Boolean)
    .join("; ");
};
