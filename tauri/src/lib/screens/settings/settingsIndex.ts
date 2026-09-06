import { rankLabel } from "$lib/app/commands.svelte";
import { accountsStore } from "$lib/data/accountsStore.svelte";
import { serverSettings } from "$lib/data/serverSettings.svelte";
import { t } from "$lib/i18n/index.svelte";
import { isDesktop, isTauri } from "$lib/platform";
import { androidBackground } from "$lib/platform/androidBackground";
import { describe, shortcuts, SHORTCUTS } from "$lib/platform/shortcuts.svelte";
import { address, backend } from "$lib/services/backend.svelte";
import { SETTINGS_SECTIONS, type SettingsSection } from "./sections";
import {
  accountSummary,
  accountValue,
  accentValue,
  chatLanguageValue,
  chatsValue,
  cliSourceValue,
  cliValue,
  effortValue,
  environmentValue,
  fastModeAvailable,
  fontValue,
  generationValue,
  hasProjects,
  hasProviderAccount,
  localeValue,
  localServerValue,
  marketplacesValue,
  mcpValue,
  memoriesValue,
  modelValue,
  multipleAccounts,
  notificationsValue,
  outputStyleValue,
  permissionValue,
  pluginsValue,
  sdkValue,
  serviceStatusValue,
  skillsValue,
  themeValue,
  toolsValue,
  userPromptValue,
} from "./settingsValues";

export type SettingsDialog =
  | "notifications"
  | "environments"
  | "local_server"
  | "user_prompt"
  | "project_prompt"
  | "export"
  | "import"
  | "reset"
  | "theme"
  | "language"
  | "font"
  | "accent"
  | "shortcuts"
  | "generation"
  | "permissions"
  | "visibility"
  | "account"
  | "account_actions"
  | "tools"
  | "chats"
  | "privacy";

export interface SettingsEntry {
  id: string;
  label: string;
  summary?: string;
  value?: () => string;
  available?: () => boolean;
  section: SettingsSection;
  group: string;
  dialog?: SettingsDialog;
}

const SETTINGS_ROWS: SettingsEntry[] = [
  { id: "theme", label: "THEME", value: themeValue, section: "client", group: "SETTINGS_CLIENT", dialog: "theme" },
  { id: "language", label: "LANGUAGE", value: localeValue, section: "client", group: "SETTINGS_CLIENT", dialog: "language" },
  { id: "accent", label: "ACCENT", value: accentValue, section: "client", group: "SETTINGS_CLIENT", dialog: "accent" },
  { id: "font", label: "FONT", value: fontValue, section: "client", group: "SETTINGS_CLIENT", dialog: "font" },
  { id: "shortcuts", label: "SHORTCUTS", summary: "SHORTCUTS_SUMMARY", section: "client", group: "SETTINGS_CLIENT", dialog: "shortcuts" },
  { id: "timestamps", label: "SHOW_TIMESTAMPS", summary: "SHOW_TIMESTAMPS_SUMMARY", section: "client", group: "SETTINGS_CLIENT" },

  { id: "notifications", label: "NOTIFICATIONS", value: notificationsValue, section: "background", group: "BACKGROUND_GROUP", dialog: "notifications" },
  { id: "battery", label: "BATTERY_OPTIMIZATION", summary: "BATTERY_OPTIMIZATION_SUMMARY", available: () => androidBackground() !== null, section: "background", group: "BACKGROUND_GROUP" },
  { id: "tray", label: "MINIMIZE_TO_TRAY", summary: "MINIMIZE_TO_TRAY_SUMMARY", available: () => isDesktop, section: "background", group: "BACKGROUND_GROUP" },

  { id: "environments", label: "ENVIRONMENTS", value: environmentValue, section: "connectivity", group: "SETTINGS_CONNECTIVITY", dialog: "environments" },
  { id: "ssh_hosts", label: "SSH_HOSTS", summary: "SSH_HOSTS_SUMMARY", available: () => isTauri, section: "connectivity", group: "SETTINGS_CONNECTIVITY" },

  { id: "generation", label: "GENERATION", value: generationValue, section: "server", group: "SETTINGS_SERVER", dialog: "generation" },
  { id: "model", label: "MODEL", value: modelValue, section: "server", group: "SETTINGS_SERVER", dialog: "generation" },
  { id: "effort", label: "EFFORT", value: effortValue, section: "server", group: "SETTINGS_SERVER", dialog: "generation" },
  { id: "output_style", label: "OUTPUT_STYLE", value: outputStyleValue, section: "server", group: "SETTINGS_SERVER", dialog: "generation" },
  { id: "chat_language", label: "CHAT_LANGUAGE", value: chatLanguageValue, section: "server", group: "SETTINGS_SERVER", dialog: "generation" },
  { id: "fast_mode", label: "FAST_MODE", summary: "FAST_MODE_DESC", available: fastModeAvailable, section: "server", group: "SETTINGS_SERVER", dialog: "generation" },
  { id: "streaming", label: "STREAMING", summary: "STREAMING_DESC", section: "server", group: "SETTINGS_SERVER", dialog: "generation" },
  { id: "task_tools", label: "TASK_TOOLS", summary: "TASK_TOOLS_DESC", section: "server", group: "SETTINGS_SERVER", dialog: "generation" },
  { id: "always_thinking", label: "ALWAYS_THINKING", summary: "ALWAYS_THINKING_DESC", section: "server", group: "SETTINGS_SERVER", dialog: "generation" },
  { id: "auto_compact", label: "AUTO_COMPACT", summary: "AUTO_COMPACT_DESC", section: "server", group: "SETTINGS_SERVER", dialog: "generation" },

  { id: "tools", label: "TOOLS", summary: "MCP_TOOLS_DESC", value: toolsValue, section: "server", group: "SETTINGS_SERVER", dialog: "tools" },
  { id: "browser_view", label: "BROWSER_VIEW", summary: "BROWSER_VIEW_DESC", section: "server", group: "SETTINGS_SERVER", dialog: "tools" },

  { id: "permissions", label: "PERMISSIONS", value: permissionValue, section: "server", group: "SETTINGS_SERVER", dialog: "permissions" },

  { id: "privacy", label: "PRIVACY", summary: "PRIVACY_SUMMARY", section: "server", group: "SETTINGS_SERVER", dialog: "privacy" },
  { id: "remote_control", label: "REMOTE_CONTROL", summary: "REMOTE_CONTROL_DESC", section: "server", group: "SETTINGS_SERVER", dialog: "privacy" },
  { id: "co_authored", label: "CO_AUTHORED", summary: "CO_AUTHORED_DESC", section: "server", group: "SETTINGS_SERVER", dialog: "privacy" },
  { id: "session_upload", label: "SESSION_UPLOAD", summary: "SESSION_UPLOAD_DESC", section: "server", group: "SETTINGS_SERVER", dialog: "privacy" },

  { id: "visibility", label: "VISIBILITY", summary: "VISIBILITY_SUMMARY", section: "server", group: "SETTINGS_SERVER", dialog: "visibility" },
  { id: "simple_mode", label: "SIMPLE_MODE", summary: "SIMPLE_MODE_SUMMARY", section: "server", group: "SETTINGS_SERVER", dialog: "visibility" },
  { id: "show_tokens", label: "SHOW_TOKENS", summary: "SHOW_TOKENS_SUMMARY", section: "server", group: "SETTINGS_SERVER", dialog: "visibility" },
  { id: "show_thinking", label: "THINKING", section: "server", group: "SETTINGS_SERVER", dialog: "visibility" },
  { id: "show_tool_use", label: "TOOLS", section: "server", group: "SETTINGS_SERVER", dialog: "visibility" },
  { id: "show_file_change", label: "FILE_CHANGES", section: "server", group: "SETTINGS_SERVER", dialog: "visibility" },
  { id: "show_compact", label: "COMPACTED", section: "server", group: "SETTINGS_SERVER", dialog: "visibility" },
  { id: "show_working", label: "QUICK_CHAT_WORKING", section: "server", group: "SETTINGS_SERVER", dialog: "visibility" },

  { id: "chats", label: "CHATS", value: chatsValue, section: "server", group: "SETTINGS_SERVER", dialog: "chats" },
  { id: "trash", label: "TRASH", summary: "TRASH_HINT", section: "server", group: "SETTINGS_SERVER", dialog: "chats" },
  { id: "retention", label: "RETENTION_DAYS", summary: "RETENTION_DAYS_HINT", section: "server", group: "SETTINGS_SERVER", dialog: "chats" },
  { id: "retention_never", label: "RETENTION_NEVER", summary: "RETENTION_NEVER_DESC", section: "server", group: "SETTINGS_SERVER", dialog: "chats" },

  { id: "account", label: "ACCOUNT", value: accountValue, available: multipleAccounts, section: "server", group: "SETTINGS_SERVER", dialog: "account" },
  { id: "server", label: "SERVER_VERSION", section: "server", group: "SETTINGS_SERVER" },

  { id: "local_server", label: "LOCAL_SERVER", value: localServerValue, available: () => isDesktop, section: "server", group: "LOCAL_SERVER", dialog: "local_server" },
  { id: "local_server_start", label: "LOCAL_SERVER_START", available: () => isDesktop, section: "server", group: "LOCAL_SERVER" },

  { id: "service_status", label: "SERVICE_STATUS", value: serviceStatusValue, section: "claude", group: "SERVICE_STATUS" },

  { id: "cli", label: "CLI", value: cliValue, section: "claude", group: "CLI" },
  { id: "cli_source", label: "CLI_SOURCE", value: cliSourceValue, section: "claude", group: "CLI" },
  { id: "sdk", label: "SDK", value: sdkValue, section: "claude", group: "CLI" },
  { id: "sdk_auto_update", label: "SDK_AUTO_UPDATE", summary: "SDK_AUTO_UPDATE_SUMMARY", section: "claude", group: "CLI" },
  { id: "user_prompt", label: "USER_PROMPT", summary: "USER_PROMPT_SUMMARY", value: userPromptValue, section: "claude", group: "CLI", dialog: "user_prompt" },
  { id: "project_prompt", label: "PROJECT_PROMPT", summary: "PROJECT_PROMPT_SUMMARY", available: hasProjects, section: "claude", group: "CLI", dialog: "project_prompt" },

  { id: "plugins", label: "PLUGINS", value: pluginsValue, section: "claude", group: "EXTENSIONS" },
  { id: "skills", label: "SKILLS", value: skillsValue, section: "claude", group: "EXTENSIONS" },
  { id: "mcp", label: "MCP_SERVERS", value: mcpValue, section: "claude", group: "EXTENSIONS" },
  { id: "marketplaces", label: "MARKETPLACES", value: marketplacesValue, section: "claude", group: "EXTENSIONS" },
  { id: "memories", label: "MEMORIES", value: memoriesValue, section: "claude", group: "EXTENSIONS" },

  { id: "usage", label: "USAGE", section: "claude", group: "USAGE" },
  { id: "accounts", label: "ACCOUNTS", section: "claude", group: "ACCOUNTS" },
  { id: "account_context", label: "ACCOUNT_CONTEXT", summary: "ACCOUNT_CONTEXT_SUMMARY", available: hasProviderAccount, section: "claude", group: "ACCOUNTS" },

  { id: "export", label: "EXPORT_SETTINGS", summary: "EXPORT_SETTINGS_SUMMARY", section: "recovery", group: "SETTINGS_RECOVERY", dialog: "export" },
  { id: "import", label: "IMPORT_SETTINGS", summary: "IMPORT_SETTINGS_SUMMARY", section: "recovery", group: "SETTINGS_RECOVERY", dialog: "import" },
  { id: "reset", label: "RESET_SETTINGS", summary: "RESET_SETTINGS_SUMMARY", section: "recovery", group: "SETTINGS_RECOVERY", dialog: "reset" },

  { id: "about", label: "APP_NAME", section: "about", group: "ABOUT" },
  { id: "support", label: "SUPPORT_CREATOR", section: "about", group: "ABOUT" },
  { id: "repository", label: "REPOSITORY", section: "about", group: "ABOUT" },
];

const SHORTCUT_ENTRIES: SettingsEntry[] = SHORTCUTS.map((shortcut) => ({
  id: `shortcut.${shortcut.id}`,
  label: shortcut.label,
  value: () => describe(shortcuts.keys(shortcut.id)) || t("SHORTCUTS_UNASSIGNED"),
  section: "client",
  group: "SHORTCUTS",
  dialog: "shortcuts",
}));

const toolEntries = (): SettingsEntry[] => {
  const seen = new Map<string, SettingsEntry>();
  for (const tool of serverSettings.capabilities?.mcpTools ?? []) {
    const key = tool.group ?? tool.name;
    if (seen.has(key)) continue;
    seen.set(key, {
      id: `tool.${key}`,
      label: key,
      summary: (tool.group ? tool.groupDescription : tool.description) || undefined,
      section: "server",
      group: "TOOLS",
      dialog: "tools",
    });
  }
  return [...seen.values()];
};

const environmentEntries = (): SettingsEntry[] =>
  backend.environments.map((profile) => ({
    id: `environment.${profile.id}`,
    label: profile.name,
    value: () => address(profile),
    section: "connectivity",
    group: "SETTINGS_CONNECTIVITY",
    dialog: "environments",
  }));

const accountEntries = (): SettingsEntry[] =>
  (serverSettings.capabilities?.accounts ?? []).map((account) => ({
    id: `account.${account.id}`,
    label: account.label,
    available: multipleAccounts,
    section: "server",
    group: "SETTINGS_SERVER",
    dialog: "account",
  }));

export const ACCOUNT_PREFIX = "claude_account.";

export const accountIdOf = (target: string | null): string =>
  target?.startsWith(ACCOUNT_PREFIX) ? target.slice(ACCOUNT_PREFIX.length) : "";

const claudeAccountEntries = (): SettingsEntry[] =>
  accountsStore.items.map((account) => ({
    id: `${ACCOUNT_PREFIX}${account.id}`,
    label: account.label,
    value: () => accountSummary(account),
    section: "claude",
    group: "ACCOUNTS",
    dialog: "account_actions",
  }));

const permissionEntries = (): SettingsEntry[] =>
  (serverSettings.capabilities?.permissionModes ?? []).map((mode) => ({
    id: `permission.${mode.id}`,
    label: mode.label,
    section: "server",
    group: "SETTINGS_SERVER",
    dialog: "permissions",
  }));

const allEntries = (): SettingsEntry[] => [
  ...SETTINGS_ROWS,
  ...SHORTCUT_ENTRIES,
  ...toolEntries(),
  ...environmentEntries(),
  ...accountEntries(),
  ...claudeAccountEntries(),
  ...permissionEntries(),
];

export const SETTINGS_INDEX: SettingsEntry[] = [...SETTINGS_ROWS, ...SHORTCUT_ENTRIES];

export const entryFor = (id: string | null): SettingsEntry | undefined =>
  allEntries().find((entry) => entry.id === id);

export const sectionLabel = (id: SettingsSection): string =>
  SETTINGS_SECTIONS.find((section) => section.id === id)?.label ?? id;

export const entryHint = (entry: SettingsEntry): string => {
  const current = entry.value?.();
  if (current) return current;
  if (entry.summary) return t(entry.summary);
  const holder = entry.dialog ? entryFor(entry.dialog) : undefined;
  const place = t(holder?.label ?? entry.group);
  return place === t(entry.label) || place === t(sectionLabel(entry.section)) ? "" : place;
};

const score = (entry: SettingsEntry, query: string): number => {
  const fields = [t(entry.label), entry.summary ? t(entry.summary) : "", t(entry.group)];
  const scores = fields.map((field) => rankLabel(field, query)).filter((value) => value >= 0);
  return scores.length ? Math.min(...scores) : -1;
};

export const searchSettings = (query: string): SettingsEntry[] => {
  if (!query.trim()) return [];
  return allEntries().filter((entry) => entry.available?.() !== false)
    .map((entry) => ({ entry, score: score(entry, query) }))
    .filter((item) => item.score >= 0)
    .sort((a, b) => a.score - b.score)
    .map((item) => item.entry);
};
