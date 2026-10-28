import { accountsStore } from "$lib/data/accountsStore.svelte";
import { chatBackground } from "$lib/data/chatBackground.svelte";
import { NO_BACKGROUND, type BackgroundArt, type BackgroundStyle } from "$lib/design/backgrounds";
import { chatListFor } from "$lib/data/chatList.svelte";
import { claudeStatus } from "$lib/data/claudeStatus.svelte";
import { projectNameOf } from "$lib/data/models";
import { serverSettings } from "$lib/data/serverSettings.svelte";
import { settings } from "$lib/data/settings.svelte";
import { formatDays, joined } from "$lib/data/format";
import { DYNAMIC_ACCENT, THEME_ACCENT } from "$lib/design/accents";
import type { PackBackground, PackFont, PackTerminal, PackTheme } from "$lib/design/packs/model";
import { packs } from "$lib/design/packs/registry.svelte";
import { FONT_KINDS, THEME_KINDS } from "$lib/design/packs/schema";
import { theme } from "$lib/design/theme.svelte";
import { i18n, LOCALES, localeName, plural, t } from "$lib/i18n/index.svelte";
import { offeredPacks } from "$lib/screens/packs/packText";
import { tabs } from "$lib/screens/chat/tabs.svelte";
import { indicatorLabel } from "$lib/screens/claude/serviceStatus";
import type { Account } from "$lib/services/accountsApi";
import { agents } from "$lib/services/agents.svelte";
import { address, backend } from "$lib/services/backend.svelte";
import { localServer, localServerStateOf } from "$lib/services/localServer.svelte";
import { notifier } from "$lib/services/notifier.svelte";
import { RETENTION_FOREVER_DAYS } from "$lib/services/settingsApi";
import type { SelectOption } from "$lib/ui/SelectDialog.svelte";

export const appearanceOptions = (): SelectOption[] => [
  { value: "system", label: t("THEME_SYSTEM") },
  { value: "light", label: t("THEME_LIGHT") },
  { value: "dark", label: t("THEME_DARK") },
];

export const localeOptions = (): SelectOption[] => [
  { value: "system", label: t("LANGUAGE_SYSTEM") },
  ...LOCALES.map((code) => ({ value: code, label: localeName(code) })),
];

export const fontLabel = (font: PackFont): string => font.name ?? t("FONT_SYSTEM");

export const packLabel = (id: string): string | null => {
  const pack = packs.packOf(id);
  return pack && !pack.builtin ? joined(pack.info.name, pack.info.author) : null;
};

const THEME_SWATCHES = ["background", "surface-variant", "on-background"];

const TERMINAL_SWATCHES = ["background", "foreground", "red", "blue"];

export const themeSwatches = (item: PackTheme): string[] => [...THEME_SWATCHES.map((key) => item.colors[key]), item.accent];

export const terminalSwatches = (item: PackTerminal): string[] => TERMINAL_SWATCHES.map((key) => item.colors[key]);

const chosen = (options: SelectOption[], value: string): string =>
  options.find((option) => option.value === value)?.label ?? value;

export const appearanceValue = (): string => chosen(appearanceOptions(), theme.mode);

export const BACKGROUND_STYLE_LABELS: Record<BackgroundStyle, string> = {
  sharp: "BACKGROUND_STYLE_SHARP",
  soft: "BACKGROUND_STYLE_SOFT",
  dark: "BACKGROUND_STYLE_DARK",
};

const BACKGROUND_ART_LABELS: Record<BackgroundArt, string> = {
  logo: "BACKGROUND_LOGO",
};

export const packBackgroundLabel = (background: PackBackground): string =>
  background.name ?? t(BACKGROUND_ART_LABELS[background.id as BackgroundArt]);

export const backgroundLabel = (id: string): string => {
  if (id === NO_BACKGROUND) return t("CHAT_BACKGROUND_NONE");
  const background = packs.backgroundOf(id);
  return background ? packBackgroundLabel(background) : t("BACKGROUND_UPLOAD");
};

export const chatBackgroundValue = (): string => backgroundLabel(chatBackground.current);

export const themeValue = (): string =>
  joined(
    ...THEME_KINDS.map((kind) => packs.themeOf(kind, theme.themeIds[kind]).name),
    packs.terminalOf(theme.terminalId).name,
  );

export const localeValue = (): string => chosen(localeOptions(), i18n.locale);

export const fontValue = (): string =>
  joined(...FONT_KINDS.map((kind) => fontLabel(packs.fontOf(kind, theme.fonts[kind]))));

export const accentLabel = (choice: string | null): string =>
  choice === null
    ? t("COLOR_NONE")
    : choice === DYNAMIC_ACCENT
      ? t("ACCENT_DYNAMIC")
      : choice === THEME_ACCENT
        ? t("ACCENT_THEME")
        : (packs.accentOf(choice)?.name ?? t("ACCENT_THEME"));

export const accentValue = (): string => accentLabel(theme.accentId);

export const packsValue = (): string => {
  const offered = offeredPacks().length;
  return joined(
    packs.installed.length ? plural("PACKS_INSTALLED_COUNT", packs.installed.length) : t("NO_PACKS_INSTALLED"),
    offered > 0 && plural("PACKS_SERVER_COUNT", offered),
  );
};

export const agentsValue = (): string => {
  const installed = agents.listOf(backend.active)?.agents.length ?? 0;
  return installed ? plural("AGENTS_INSTALLED_COUNT", installed) : t("AGENTS_NONE");
};

export const notificationsValue = (): string =>
  notifier.granted
    ? t("NOTIFICATIONS_STATE", [settings.notifyInteraction, settings.notifyTaskDone].filter(Boolean).length)
    : t("NOTIFICATIONS_DISABLED");

export const discordValue = (): string =>
  settings.discord.enabled ? t("OPTION_ON") : t("OPTION_OFF");

export const environmentValue = (): string =>
  backend.active ? joined(backend.active.name, address(backend.active)) : t("NO_ENVIRONMENTS");

export const fastModeAvailable = (): boolean =>
  serverSettings.capabilities?.models.some((model) => model.fastMode) === true;

export const multipleAccounts = (): boolean =>
  (serverSettings.capabilities?.accounts.length ?? 0) > 1;

export const hasProviderAccount = (): boolean =>
  serverSettings.capabilities?.accounts.some((account) => account.provider) === true;

export const scopeLabel = (id: string): string => t(`ACCOUNT_CONTEXT_${id.toUpperCase()}`);

export const trimmedScope = (scope: string): string => {
  const scopes = accountsStore.snapshot?.scopes ?? [];
  return scope && scope !== scopes[0] ? scopeLabel(scope) : "";
};

export const accountSummary = (account: Account): string => {
  if (account.provider) {
    return joined(account.provider.baseUrl, trimmedScope(account.provider.contextScope));
  }
  if (!account.loggedIn) return t("ACCOUNT_PENDING");
  return account.id === accountsStore.defaultId ? t("ACCOUNT_IS_DEFAULT") : t("ACCOUNT_CONNECTED");
};

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
  return model ? joined(model, effortValue()) : "";
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

const hiddenTools = (): Set<string> =>
  new Set(
    (serverSettings.snapshot?.mcpDisabled ?? "")
      .split(",")
      .map((name) => name.trim())
      .filter(Boolean),
  );

const toolStates = (): boolean[] => {
  const hidden = hiddenTools();
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
  claudeStatus.prompts?.user
    .split("\n")
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

export const sessionsValue = (): string => {
  const snapshot = serverSettings.snapshot;
  if (!snapshot) return "";
  return joined(snapshot.persistentSessions && t("PERSISTENT_SESSIONS"), t("SESSION_LIMIT_VALUE", snapshot.sessionLimit));
};

export const chatsValue = (): string => {
  const snapshot = serverSettings.snapshot;
  if (!snapshot) return "";
  return joined(
    t(snapshot.trashEnabled ? "TRASH_ON" : "TRASH_OFF"),
    snapshot.retentionDays >= RETENTION_FOREVER_DAYS
      ? t("RETENTION_NEVER")
      : formatDays(snapshot.retentionDays),
  );
};
