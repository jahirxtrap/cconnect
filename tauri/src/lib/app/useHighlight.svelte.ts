import { navigation } from "./navigation.svelte";

const FLASH_MS = 880;

export interface Highlight {
  readonly target: string | null;
  is: (target: string) => boolean;
}

/** Flashes whatever `navigation.settingsHighlight` points at, then clears it. */
export const useHighlight = (onTarget?: (target: string) => void): Highlight => {
  let flashed = $state<string | null>(null);

  $effect(() => {
    const target = navigation.settingsHighlight;
    if (!target) return;
    onTarget?.(target);
    flashed = target;
    const timer = setTimeout(() => {
      flashed = null;
      navigation.settingsHighlight = null;
    }, FLASH_MS);
    return () => clearTimeout(timer);
  });

  return {
    get target() {
      return flashed;
    },
    is: (target: string) => flashed === target,
  };
};
