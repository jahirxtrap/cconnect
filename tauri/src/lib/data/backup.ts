import { i18n, type Locale } from "$lib/i18n/index.svelte";
import { theme, type FontStyle, type ThemeMode } from "$lib/design/theme.svelte";
import { backend, type AuthKind, type EnvironmentProfile } from "$lib/services/backend.svelte";
import { settings } from "./settings.svelte";
import { sshStore, type SshProfile } from "./sshStore.svelte";

// Shared with the Compose client: same keys so a backup moves between both apps.
const APP = "cconnect";
const FORMAT = 1;
const DEFAULT_SSH_PORT = 22;

type Wire = Record<string, unknown>;

const text = (raw: Wire, key: string): string | null => (typeof raw[key] === "string" ? (raw[key] as string) : null);
const flag = (raw: Wire, key: string): boolean | null =>
  typeof raw[key] === "boolean" ? (raw[key] as boolean) : null;
const number = (raw: Wire, key: string): number | null =>
  typeof raw[key] === "number" ? (raw[key] as number) : null;
const list = (raw: Wire, key: string): Wire[] => (Array.isArray(raw[key]) ? (raw[key] as Wire[]) : []);

export const exportSettings = (): string =>
  JSON.stringify(
    {
      app: APP,
      version: FORMAT,
      settings: {
        theme_mode: theme.mode,
        dynamic_color: theme.dynamicColor,
        accent_index: theme.accentIndex,
        font_style: theme.fontStyle,
        // The Compose client stores "" for "follow the system".
        language: i18n.locale === "system" ? "" : i18n.locale,
        show_timestamps: settings.showTimestamps,
        markdown_preview_formatted: settings.markdownPreviewFormatted,
        notify_task_done: settings.notifyTaskDone,
        notify_interaction: settings.notifyInteraction,
        sidebar_expanded: settings.sidebarExpanded,
        minimize_to_tray: settings.minimizeToTray,
        window_maximized: settings.windowMaximized,
        cwd: settings.cwd,
        file_sort_field: settings.fileSortField,
        file_sort_ascending: settings.fileSortAscending,
        local_server_enabled: settings.localServerEnabled,
        local_server_dir: settings.localServerDir,
        local_server_python: settings.localServerPython,
        local_server_python_path: settings.localServerPythonPath,
        local_server_mode: settings.localServerMode,
        local_server_public_host: settings.localServerPublicHost,
      },
      ...(backend.activeId ? { active_environment: backend.activeId } : {}),
      environments: backend.environments.map((profile) => ({
        id: profile.id,
        name: profile.name,
        kind: profile.kind,
        host: profile.host,
        ...(profile.port === null ? {} : { port: profile.port }),
        auth_kind: profile.authKind,
        auth_token: profile.authToken,
        auth_user: profile.authUser,
        auth_password: profile.authPassword,
        auth_header_name: profile.authHeaderName,
        auth_header_value: profile.authHeaderValue,
        directory: profile.directory,
        account: profile.account,
        model: profile.model,
        effort: profile.effort,
        permission_mode: profile.permissionMode,
        ...(profile.streaming === null ? {} : { streaming: profile.streaming }),
        ...(profile.accentIndex === null ? {} : { accent_index: profile.accentIndex }),
      })),
      ssh: sshStore.profiles.map((profile) => ({
        id: profile.id,
        name: profile.name,
        host: profile.host,
        port: profile.port,
        user: profile.user,
        password: profile.password,
        ...(profile.os === null ? {} : { os: profile.os }),
      })),
    },
    null,
    2,
  );

const applySettings = (values: Wire) => {
  const mode = text(values, "theme_mode");
  if (mode === "system" || mode === "light" || mode === "dark") theme.setMode(mode as ThemeMode);
  const dynamic = flag(values, "dynamic_color");
  if (dynamic !== null) theme.setDynamicColor(dynamic);
  const accent = number(values, "accent_index");
  if (accent !== null) theme.setAccent(accent);
  const font = text(values, "font_style");
  if (font === "system" || font === "flat" || font === "color") theme.setFontStyle(font as FontStyle);
  const language = text(values, "language");
  if (language !== null) i18n.set((language || "system") as Locale);

  const booleans: Array<[string, (value: boolean) => void]> = [
    ["show_timestamps", (value) => (settings.showTimestamps = value)],
    ["markdown_preview_formatted", (value) => (settings.markdownPreviewFormatted = value)],
    ["notify_task_done", (value) => (settings.notifyTaskDone = value)],
    ["notify_interaction", (value) => (settings.notifyInteraction = value)],
    ["sidebar_expanded", (value) => (settings.sidebarExpanded = value)],
    ["minimize_to_tray", (value) => (settings.minimizeToTray = value)],
    ["window_maximized", (value) => (settings.windowMaximized = value)],
    ["file_sort_ascending", (value) => (settings.fileSortAscending = value)],
    ["local_server_enabled", (value) => (settings.localServerEnabled = value)],
  ];
  for (const [key, apply] of booleans) {
    const value = flag(values, key);
    if (value !== null) apply(value);
  }

  const strings: Array<[string, (value: string) => void]> = [
    ["cwd", (value) => (settings.cwd = value)],
    ["file_sort_field", (value) => (settings.fileSortField = value)],
    ["local_server_dir", (value) => (settings.localServerDir = value)],
    ["local_server_python", (value) => (settings.localServerPython = value)],
    ["local_server_python_path", (value) => (settings.localServerPythonPath = value)],
    ["local_server_mode", (value) => (settings.localServerMode = value)],
    ["local_server_public_host", (value) => (settings.localServerPublicHost = value)],
  ];
  for (const [key, apply] of strings) {
    const value = text(values, key);
    if (value !== null) apply(value);
  }
};

const toEnvironment = (raw: Wire): EnvironmentProfile | null => {
  const id = text(raw, "id");
  if (!id) return null;
  const kind = text(raw, "kind") === "https" ? "https" : "http";
  return {
    id,
    name: text(raw, "name") ?? "",
    kind,
    host: text(raw, "host") ?? "",
    port: number(raw, "port"),
    authKind: (text(raw, "auth_kind") ?? "none") as AuthKind,
    authToken: text(raw, "auth_token") ?? "",
    authUser: text(raw, "auth_user") ?? "",
    authPassword: text(raw, "auth_password") ?? "",
    authHeaderName: text(raw, "auth_header_name") ?? "",
    authHeaderValue: text(raw, "auth_header_value") ?? "",
    directory: text(raw, "directory") ?? "",
    account: text(raw, "account") ?? "",
    model: text(raw, "model") ?? "",
    effort: text(raw, "effort") ?? "",
    permissionMode: text(raw, "permission_mode") ?? "",
    streaming: flag(raw, "streaming"),
    accentIndex: number(raw, "accent_index"),
  };
};

const toSshProfile = (raw: Wire): SshProfile | null => {
  const id = text(raw, "id");
  if (!id) return null;
  return {
    id,
    name: text(raw, "name") ?? "",
    host: text(raw, "host") ?? "",
    port: number(raw, "port") ?? DEFAULT_SSH_PORT,
    user: text(raw, "user") ?? "",
    password: text(raw, "password") ?? "",
    os: text(raw, "os"),
  };
};

export const importSettings = (raw: string): boolean => {
  let root: Wire | null;
  try {
    root = JSON.parse(raw) as Wire | null;
  } catch {
    return false;
  }
  if (!root || typeof root !== "object" || text(root, "app") !== APP) return false;

  const values = root.settings;
  if (values && typeof values === "object") applySettings(values as Wire);

  const environments = list(root, "environments")
    .map(toEnvironment)
    .filter((profile): profile is EnvironmentProfile => profile !== null);
  if (environments.length) backend.save(environments);

  const active = text(root, "active_environment");
  if (active) backend.select(active);

  const profiles = list(root, "ssh")
    .map(toSshProfile)
    .filter((profile): profile is SshProfile => profile !== null);
  if (profiles.length) sshStore.replaceAll(profiles);

  return true;
};
