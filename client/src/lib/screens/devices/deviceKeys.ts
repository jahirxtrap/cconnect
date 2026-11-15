import Circle from "@lucide/svelte/icons/circle";
import Power from "@lucide/svelte/icons/power";
import Square from "@lucide/svelte/icons/square";
import Triangle from "@lucide/svelte/icons/triangle";
import Volume1 from "@lucide/svelte/icons/volume-1";
import Volume2 from "@lucide/svelte/icons/volume-2";
import { t } from "$lib/i18n/index.svelte";
import type { SoftKey } from "$lib/ui/SoftKeys.svelte";

export const deviceKeys = (): SoftKey<string>[] => [
  { icon: Triangle, iconClass: "-rotate-90", title: t("BACK"), value: "back" },
  { icon: Circle, title: t("DEVICE_KEY_HOME"), value: "home" },
  { icon: Square, title: t("DEVICE_KEY_RECENTS"), value: "recents" },
  { icon: Power, title: t("DEVICE_KEY_POWER"), value: "power" },
  { icon: Volume1, title: t("DEVICE_VOLUME_DOWN"), value: "volume_down" },
  { icon: Volume2, title: t("DEVICE_VOLUME_UP"), value: "volume_up" },
];

export const TYPED_KEYS = new Set([
  "Enter",
  "Backspace",
  "Delete",
  "Tab",
  "Escape",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "Home",
  "End",
  "PageUp",
  "PageDown",
]);
