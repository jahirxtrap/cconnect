import Activity from "@lucide/svelte/icons/activity";
import Compass from "@lucide/svelte/icons/compass";
import FolderSymlink from "@lucide/svelte/icons/folder-symlink";
import FolderTree from "@lucide/svelte/icons/folder-tree";
import Network from "@lucide/svelte/icons/network";
import NotepadText from "@lucide/svelte/icons/notepad-text";
import SquareTerminal from "@lucide/svelte/icons/square-terminal";
import { isTauri } from "$lib/platform";
import type { RightKind } from "$lib/screens/chat/panes.svelte";
import ClaudeIcon from "$lib/ui/ClaudeIcon.svelte";
import type { IconSource } from "$lib/ui/icons";
import { navigation } from "./navigation.svelte";

export interface ScreenEntry {
  kind: RightKind;
  label: string;
  icon: IconSource;
  open: () => void;
  screenLabel?: string;
  screenIcon?: IconSource;
  nativeScreen?: boolean;
  paneOnly?: boolean;
}

export const SCREENS: ScreenEntry[] = [
  { kind: "shared", label: "SHARED", icon: FolderSymlink, open: () => navigation.openShared() },
  {
    kind: "project",
    label: "PROJECT_FILES",
    icon: FolderTree,
    open: () => navigation.navigate("/project"),
    paneOnly: true,
  },
  { kind: "claude", label: "CLAUDE", icon: ClaudeIcon, open: () => navigation.navigate("/claude") },
  { kind: "monitor", label: "MONITOR", icon: Activity, open: () => navigation.navigate("/monitor") },
  {
    kind: "terminal",
    label: "TERMINAL",
    icon: SquareTerminal,
    open: () => navigation.openSshHosts(),
    screenLabel: "SSH_HOSTS",
    screenIcon: Network,
    nativeScreen: true,
  },
  { kind: "notes", label: "NOTES", icon: NotepadText, open: () => navigation.navigate("/notes") },
  {
    kind: "browser",
    label: "BROWSER",
    icon: Compass,
    open: () => navigation.navigate("/browser"),
    paneOnly: true,
  },
];

export const NAV_SCREENS = SCREENS.filter(
  (screen) => !screen.paneOnly && (isTauri || !screen.nativeScreen),
);

export const screenFor = (kind: RightKind) =>
  SCREENS.find((screen) => screen.kind === kind) ?? SCREENS[0];
