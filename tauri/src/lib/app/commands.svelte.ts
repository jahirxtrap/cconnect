import { activeScope } from "$lib/app/activeScope.svelte";
import { navigation } from "$lib/app/navigation.svelte";
import { NAV_SCREENS } from "$lib/app/screens";
import { chatListFor } from "$lib/data/chatList.svelte";
import { projectLabel, projectNameOf, type SessionInfo } from "$lib/data/models";
import { t } from "$lib/i18n/index.svelte";
import { shortcuts } from "$lib/platform/shortcuts.svelte";
import { panes } from "$lib/screens/chat/panes.svelte";
import { tabs } from "$lib/screens/chat/tabs.svelte";
import { SETTINGS_SECTIONS } from "$lib/screens/settings/sections";
import { backend } from "$lib/services/backend.svelte";
import type { IconSource } from "$lib/ui/icons";

export type CommandGroup = "action" | "screen" | "chat" | "project" | "settings";

export interface Command {
  id: string;
  group: CommandGroup;
  label: string;
  detail?: string | null;
  hint?: string;
  icon?: IconSource;
  run: () => void;
}

const strip = (value: string) =>
  value
    .toLocaleLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");

export const rankLabel = (label: string, query: string): number => rank(label, strip(query.trim()));

const rank = (label: string, query: string): number => {
  const haystack = strip(label);
  if (haystack.startsWith(query)) return 0;
  if (haystack.includes(` ${query}`)) return 1;
  return haystack.includes(query) ? 2 : -1;
};

const focusedChat = () => (panes.focusedTab ? tabs.stateFor(panes.focusedTab) : tabs.state);

const sessionLabel = (session: SessionInfo) =>
  session.title?.trim() || session.preview?.trim() || t("NEW_CHAT");

export const collectCommands = (): Command[] => {
  const scope = activeScope();
  const scopes = scope === "global" ? ["global" as const] : [scope, "global" as const];
  const list = chatListFor(backend.active);
  const projects = list?.projects ?? [];

  const actions: Command[] = shortcuts.available(scopes).map((shortcut) => ({
    id: `action:${shortcut.id}`,
    group: "action",
    label: t(shortcut.label),
    hint: shortcuts.hint(shortcut.id),
    run: () => shortcuts.run(shortcut.id),
  }));

  const screens: Command[] = NAV_SCREENS.map((screen) => ({
    id: `screen:${screen.kind}`,
    group: "screen",
    label: t(screen.screenLabel ?? screen.label),
    icon: screen.screenIcon ?? screen.icon,
    run: screen.open,
  }));

  const settings: Command[] = SETTINGS_SECTIONS.map((section) => ({
    id: `settings:${section.id}`,
    group: "settings",
    label: t(section.label),
    run: () => navigation.openSettings(section.id === "general" ? null : section.id),
  }));

  const chats: Command[] = (list?.sessions ?? []).map((session) => ({
    id: `chat:${session.sessionId}`,
    group: "chat",
    label: sessionLabel(session),
    detail: session.projectKey
      ? projectNameOf(projects, session.projectKey, session.path)
      : null,
    run: () => panes.openSession(session),
  }));

  const projectCommands: Command[] = projects.map((project) => ({
    id: `project:${project.projectKey}`,
    group: "project",
    label: projectLabel(project),
    detail: project.path,
    run: () => focusedChat().selectHistoryProject(project.projectKey),
  }));

  return [...actions, ...screens, ...chats, ...projectCommands, ...settings];
};

export const filterCommands = (commands: Command[], query: string): Command[] => {
  const needle = strip(query.trim());
  if (!needle) return commands;
  return commands
    .map((command) => ({ command, score: rank(command.label, needle) }))
    .filter((entry) => entry.score >= 0)
    .sort((a, b) => a.score - b.score)
    .map((entry) => entry.command);
};
