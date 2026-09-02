import { shortcuts } from "./shortcuts.svelte";

export const useShortcut = (id: string, handler: () => boolean | void) => {
  $effect(() => shortcuts.register(id, handler));
};
