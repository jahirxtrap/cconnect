import ChevronDown from "@lucide/svelte/icons/chevron-down";
import ChevronLeft from "@lucide/svelte/icons/chevron-left";
import ChevronRight from "@lucide/svelte/icons/chevron-right";
import ChevronUp from "@lucide/svelte/icons/chevron-up";
import Eraser from "@lucide/svelte/icons/eraser";
import LogOut from "@lucide/svelte/icons/log-out";
import Pause from "@lucide/svelte/icons/pause";
import Square from "@lucide/svelte/icons/square";
import type { SoftKey } from "$lib/ui/SoftKeys.svelte";

export const TERMINAL_KEYS: SoftKey<number[]>[] = [
  { label: "Esc", title: "Esc", value: [0x1b] },
  { label: "Tab", title: "Tab", value: [0x09] },
  { icon: ChevronUp, title: "↑", value: [0x1b, 0x5b, 0x41] },
  { icon: ChevronDown, title: "↓", value: [0x1b, 0x5b, 0x42] },
  { icon: ChevronLeft, title: "←", value: [0x1b, 0x5b, 0x44] },
  { icon: ChevronRight, title: "→", value: [0x1b, 0x5b, 0x43] },
  { icon: Square, title: "Ctrl+C", value: [0x03] },
  { icon: LogOut, title: "Ctrl+D", value: [0x04] },
  { icon: Eraser, title: "Ctrl+L", value: [0x0c] },
  { icon: Pause, title: "Ctrl+Z", value: [0x1a] },
  { label: "Home", title: "Home", value: [0x1b, 0x5b, 0x48] },
  { label: "End", title: "End", value: [0x1b, 0x5b, 0x46] },
];
