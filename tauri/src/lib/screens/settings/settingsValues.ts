import { chatListFor } from "$lib/data/chatList.svelte";
import { claudeStatus } from "$lib/data/claudeStatus.svelte";
import { projectNameOf } from "$lib/data/models";
import { serverSettings } from "$lib/data/serverSettings.svelte";
import { settings } from "$lib/data/settings.svelte";
import { formatDays } from "$lib/data/format";
import { ACCENTS } from "$lib/design/accents";
import { theme, type FontStyle } from "$lib/design/theme.svelte";
import { i18n, t } from "$lib/i18n/index.svelte";
import { tabs } from "$lib/screens/chat/tabs.svelte";
import { indicatorLabel } from "$lib/screens/claude/serviceStatus";
import { address, backend } from "$lib/services/backend.svelte";
import { localServer, localServerStateOf } from "$lib/services/localServer.svelte";
import { notifier } from "$lib/services/notifier.svelte";
import { RETENTION_FOREVER_DAYS } from "$lib/services/settingsApi";
import type { SelectOption } from "$lib/ui/SelectDialog.svelte";

export const FONT_FAMILIES: Record<FontStyle, string> = {
  system: "system-ui, sans-serif",
  flat: '"CConnect Flat", system-ui, sans-serif',
  color: '"CConnect Color", system-ui, sans-serif',
};

export const themeOptions = (): SelectOption[] => [
  { value: "system", label: t("THEME_SYSTEM") },
  { value: "light", label: t("THEME_LIGHT") },
  { value: "dark", label: t("THEME_DARK") },
];

export const localeOptions = (): SelectOption[] => [
  { value: "system", label: t("LANGUAGE_SYSTEM") },
  { value: "en", label: "English" },
  { value: "es", label: "Español" },
];

export const fontOptions = (): SelectOption[] => [
  { value: "system", label: t("FONT_SYSTEM"), font: FONT_FAMILIES.system },
  { value: "flat", label: t("FONT_FLAT"), font: FONT_FAMILIES.flat },
  { value: "color", label: t("FONT_COLOR"), font: FONT_FAMILIES.color },
];

const chosen = (options: SelectOption[], value: string): string =>
  options.find((option) => option.value === value)?.label ?? value;

export const themeValue = (): string => chosen(themeOptions(), theme.mode);

export const localeValue = (): string => chosen(localeOptions(), i18n.locale);

export const fontValue = (): string => chosen(fontOptions(), theme.fontStyle);

export const accentValue = (): string =>
  theme.dynamicColor && theme.systemAccent ? t("ACCENT_DYNAMIC") : (ACCENTS[theme.accentIndex]?.name ?? "");

export const notificationsValue = (): string =>
  notifier.granted
    ? t("NOTIFICATIONS_STATE", [settings.notifyInteraction, settings.notifyTaskDone].filter(Boolean).length)
    : t("NOTIFICATIONS_DISABLED");

export const environmentValue = (): string =>
  backend.active ? `${backend.active.name} • ${address(backend.active)}` : t("NO_ENVIRONMENTS");

export const fastModeAvailable = (): boolean =>
  serverSettings.capabilities?.models.some((model) => model.fastMode) === true;

export const multipleAccounts = (): boolean =>
  (serverSettings.capabilities?.accounts.length ?? 0) > 1;

export const hasProviderAccount = (): boolean =>
  serverSettings.capabilities?.accounts.some((account) => account.provider) === true;

export const hasProjects = (): boolean => (chatListFor(backend.active)?.projects.length ?? 0) > 0;

export const modelValue = (): string => {
  const snapshot = serverSettings.snapshot;
  if (!snapshot) return "";
  return (
    serverSettings.capabilities?.models.find((model) => model.id === snapshot.model)?.label ??
    snapshot.model
  );
};

export const effortValue = (): string => serverSettings.snapshot?.effort ?? "";

export const generationValue = (): string => {
  const model = modelValue();
  return model ? `${model} • ${effortValue()}` : "";
};

export const outputStyleValue = (): string => serverSettings.snapshot?.outputStyle ?? "";

export const chatLanguageValue = (): string =>
  serverSettings.snapshot ? serverSettings.snapshot.chatLanguage || t("CHAT_LANGUAGE_PLACEHOLDER") : "";

export const permissionValue = (): string => {
  const snapshot = serverSettings.snapshot;
  if (!snapshot) return "";
  return (
    serverSettings.capabilities?.permissionModes.find((mode) => mode.id === snapshot.permissionMode)
      ?.label ?? snapshot.permissionMode
  );
};

export const accountValue = (): string => {
  const snapshot = serverSettings.snapshot;
  if (!snapshot) return "";
  return (
    serverSettings.capabilities?.accounts.find((account) => account.id === snapshot.account)?.label ??
    snapshot.account
  );
};

const toolStates = (): boolean[] => {
  const hidden = new Set(
    (serverSettings.snapshot?.mcpDisabled ?? "")
      .split(",")
      .map((name) => name.trim())
      .filter(Boolean),
  );
  const groups = new Map<string, boolean>();
  for (const tool of serverSettings.capabilities?.mcpTools ?? []) {
    const key = tool.group ?? tool.name;
    groups.set(key, (groups.get(key) ?? false) || !hidden.has(tool.name));
  }
  return [...groups.values()];
};

export const toolsValue = (): string => {
  if (!serverSettings.snapshot || !serverSettings.capabilities) return "";
  const states = toolStates();
  return t("MCP_TOOLS_COUNT", states.filter(Boolean).length, states.length);
};

export const cliSourceLabel = (value: string): string =>
  value === "system"
    ? t("CLI_SOURCE_SYSTEM")
    : value === "custom"
      ? t("CUSTOM_PATH")
      : value === "bundled"
        ? t("CLI_SOURCE_BUNDLED")
        : value;

export const cliValue = (): string => claudeStatus.cli?.activeVersion ?? "";

export const cliSourceValue = (): string =>
  claudeStatus.cli ? cliSourceLabel(claudeStatus.cli.source) : "";

export const sdkValue = (): string => claudeStatus.sdk?.version ?? "";

const PROMPT_SUMMARY_LENGTH = 60;

export const userPromptValue = (): string =>
  claudeStatus.userPrompt
    ?.split("\n")
    .find((line) => line.trim())
    ?.slice(0, PROMPT_SUMMARY_LENGTH) ?? "";

export const pluginsValue = (): string => {
  const extensions = claudeStatus.extensions;
  if (!extensions) return "";
  return t("ENABLED_COUNT", extensions.plugins.filter((item) => item.enabled).length, extensions.plugins.length);
};

export const skillsValue = (): string =>
  claudeStatus.skills ? String(claudeStatus.skills.length) : "";

export const mcpValue = (): string => {
  const servers = claudeStatus.mcpServers;
  if (!servers) return "";
  return t("ENABLED_COUNT", servers.filter((item) => item.enabled).length, servers.length);
};

export const marketplacesValue = (): string =>
  claudeStatus.extensions ? String(claudeStatus.extensions.marketplaces.length) : "";

export const memoriesValue = (): string => {
  const chat = tabs.state;
  const projects = chatListFor(backend.active)?.projects ?? [];
  const project = chat.defaultProjectKey(projects) ?? chat.projectKey;
  return project ? projectNameOf(projects, project, chat.cwd) : "";
};

export const serviceStatusValue = (): string => {
  const service = claudeStatus.service;
  if (!service) return "";
  return service.error !== null ? t("STATUS_UNKNOWN") : indicatorLabel(service.indicator);
};

export const localServerValue = (): string => {
  const phase = localServerStateOf(localServer.info);
  if (phase === "starting") return t("SERVER_STARTING");
  if (phase === "running") return t("SERVER_RUNNING");
  if (phase === "manual") return t("SERVER_RUNNING_MANUAL");
  if (phase === "failed") return t("SERVER_FAILED");
  return "";
};

export const chatsValue = (): string => {
  const snapshot = serverSettings.snapshot;
  if (!snapshot) return "";
  return [
    t(snapshot.trashEnabled ? "TRASH_ON" : "TRASH_OFF"),
    snapshot.retentionDays >= RETENTION_FOREVER_DAYS
      ? t("RETENTION_NEVER")
      : formatDays(snapshot.retentionDays),
  ].join(" • ");
};
