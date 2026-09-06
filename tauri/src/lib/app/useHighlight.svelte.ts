import { navigation } from "./navigation.svelte";

const FLASH_MS = 880;

export interface Highlight {
  readonly target: string | null;
  is: (target: string) => boolean;
}

export const useHighlight =(onTarget?: (target: string) => void): Highlight => {
  let flashed = $state<string | null>(null);

  $effect(() => {
    const target = navigation.settingsHighlight;
    if (!target) return;
    onTarget?.(target);
    flashed = target;
    const forget = () => {
      if (navigation.settingsHighlight === target) navigation.settingsHighlight = null;
    };
    const timer = setTimeout(() => {
      flashed = null;
      forget();
    }, FLASH_MS);
    return () => {
      clearTimeout(timer);
      forget();
    };
  });

  return {
    get target() {
      return flashed;
    },
    is: (target: string) => flashed === target,
  };
};
