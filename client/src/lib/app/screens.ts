import Activity from "@lucide/svelte/icons/activity";
import BotMessageSquare from "@lucide/svelte/icons/bot-message-square";
import Compass from "@lucide/svelte/icons/compass";
import FolderSymlink from "@lucide/svelte/icons/folder-symlink";
import FolderTree from "@lucide/svelte/icons/folder-tree";
import MessageSquareText from "@lucide/svelte/icons/message-square-text";
import Network from "@lucide/svelte/icons/network";
import NotepadText from "@lucide/svelte/icons/notepad-text";
import Puzzle from "@lucide/svelte/icons/puzzle";
import SquareTerminal from "@lucide/svelte/icons/square-terminal";
import { isTauri } from "$lib/platform";
import { panes, type RightKind } from "$lib/screens/chat/panes.svelte";
import ClaudeIcon from "$lib/ui/ClaudeIcon.svelte";
import type { IconSource } from "$lib/ui/icons";
import { navigation, type Route } from "./navigation.svelte";

export interface ScreenEntry {
  kind: RightKind;
  label: string;
  icon: IconSource;
  open: () => void;
  route?: Route;
  screenLabel?: string;
  screenIcon?: IconSource;
  nativeScreen?: boolean;
  paneOnly?: boolean;
}

export const SCREENS: ScreenEntry[] = [
  { kind: "shared", label: "SHARED", icon: FolderSymlink, open: () => navigation.openShared(), route: "/shared" },
  {
    kind: "project",
    label: "PROJECT_FILES",
    icon: FolderTree,
    open: () => navigation.navigate("/project"),
    paneOnly: true,
  },
  { kind: "claude", label: "CLAUDE", icon: ClaudeIcon, open: () => navigation.navigate("/claude"), route: "/claude" },
  { kind: "monitor", label: "MONITOR", icon: Activity, open: () => navigation.navigate("/monitor"), route: "/monitor" },
  {
    kind: "terminal",
    label: "TERMINAL",
    icon: SquareTerminal,
    open: () => navigation.openSshHosts(),
    route: "/terminal",
    screenLabel: "SSH_HOSTS",
    screenIcon: Network,
    nativeScreen: true,
  },
  { kind: "notes", label: "NOTES", icon: NotepadText, open: () => navigation.navigate("/notes"), route: "/notes" },
  {
    kind: "browser",
    label: "BROWSER",
    icon: Compass,
    open: () => navigation.navigate("/browser"),
    paneOnly: true,
  },
  {
    kind: "mods",
    label: "MODS",
    icon: Puzzle,
    open: () => panes.show("mods"),
    paneOnly: true,
  },
  {
    kind: "agents",
    label: "AGENTS",
    icon: BotMessageSquare,
    open: () => panes.show("agents"),
    paneOnly: true,
  },
];

export const DEFAULT_PANE_BAR: RightKind[] = ["terminal", "browser", "project", "mods", "agents"];

export const NAV_SCREENS = SCREENS.filter(
  (screen) => !screen.paneOnly && (isTauri || !screen.nativeScreen),
);

export const screenFor = (kind: RightKind) =>
  SCREENS.find((screen) => screen.kind === kind) ?? SCREENS[0];

export type PaneView = Pick<ScreenEntry, "kind" | "label" | "icon">;

export const CHAT_VIEW: PaneView = { kind: "chat", label: "CHAT", icon: MessageSquareText };

export const PANE_VIEWS: PaneView[] = [CHAT_VIEW, ...SCREENS];

export const viewFor = (kind: RightKind): PaneView => PANE_VIEWS.find((view) => view.kind === kind) ?? CHAT_VIEW;
