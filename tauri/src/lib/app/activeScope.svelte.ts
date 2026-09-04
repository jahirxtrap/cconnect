import { navigation } from "$lib/app/navigation.svelte";
import { paneFocus } from "$lib/data/paneFocus.svelte";
import type { ShortcutScope } from "$lib/platform/shortcuts.svelte";

export const activeScope = (): ShortcutScope => {
  if (navigation.route === "/files") return "files";
  if (navigation.route === "/terminal") return "terminal";
  if (navigation.route === "/browser") return "browser";
  if (navigation.route === "/") return paneFocus.active;
  return "global";
};
