import Activity from "@lucide/svelte/icons/activity";
import Folder from "@lucide/svelte/icons/folder";
import SquareTerminal from "@lucide/svelte/icons/square-terminal";
import Type from "@lucide/svelte/icons/type";
import type { RightKind } from "$lib/screens/chat/panes.svelte";
import ClaudeIcon from "$lib/ui/ClaudeIcon.svelte";
import type { IconSource } from "$lib/ui/icons";
import { navigation } from "./navigation.svelte";

export interface ScreenEntry {
  kind: RightKind;
  label: string;
  icon: IconSource;
  open: () => void;
}

export const SCREENS: ScreenEntry[] = [
  { kind: "files", label: "FILES", icon: Folder, open: () => navigation.openExplorer() },
  { kind: "claude", label: "CLAUDE", icon: ClaudeIcon, open: () => navigation.navigate("/claude") },
  { kind: "monitor", label: "MONITOR", icon: Activity, open: () => navigation.navigate("/monitor") },
  {
    kind: "terminal",
    label: "TERMINAL",
    icon: SquareTerminal,
    open: () => navigation.navigate("/terminal"),
  },
  { kind: "markdown", label: "MARKDOWN", icon: Type, open: () => navigation.navigate("/markdown") },
];
