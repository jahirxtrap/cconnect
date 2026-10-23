import Bell from "@lucide/svelte/icons/bell";
import History from "@lucide/svelte/icons/history";
import Info from "@lucide/svelte/icons/info";
import MonitorSmartphone from "@lucide/svelte/icons/monitor-smartphone";
import Network from "@lucide/svelte/icons/network";
import Server from "@lucide/svelte/icons/server";
import Settings from "@lucide/svelte/icons/settings";
import ClaudeIcon from "$lib/ui/ClaudeIcon.svelte";

export const SETTINGS_SECTIONS = [
  { id: "general", label: "SETTINGS_GENERAL", icon: Settings },
  { id: "client", label: "SETTINGS_CLIENT", icon: MonitorSmartphone },
  { id: "background", label: "BACKGROUND_GROUP", icon: Bell },
  { id: "connectivity", label: "SETTINGS_CONNECTIVITY", icon: Network },
  { id: "server", label: "SETTINGS_SERVER", icon: Server },
  { id: "claude", label: "CLAUDE", icon: ClaudeIcon },
  { id: "recovery", label: "SETTINGS_RECOVERY", icon: History },
  { id: "about", label: "ABOUT", icon: Info },
] as const;

export type SettingsSection = (typeof SETTINGS_SECTIONS)[number]["id"];

export const isSettingsSection = (value: string | null): value is SettingsSection =>
  SETTINGS_SECTIONS.some((section) => section.id === value);
