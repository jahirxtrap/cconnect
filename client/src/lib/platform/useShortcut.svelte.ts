import { shortcuts } from "./shortcuts.svelte";

export const useShortcut = (id: string, handler: () => boolean | void, when: () => boolean = () => true) => {
  $effect(() => (when() ? shortcuts.register(id, handler) : undefined));
};
