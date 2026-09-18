import { i18n, type Locale } from "$lib/i18n/index.svelte";
import { theme, type FontStyle, type ThemeMode } from "$lib/design/theme.svelte";
import { notes, type Note } from "$lib/screens/notes/notes.svelte";
import { backend, type AuthKind, type EnvironmentProfile } from "$lib/services/backend.svelte";
import { shortcuts } from "$lib/platform/shortcuts.svelte";
import { settings, type VisibilityPrefs } from "./settings.svelte";
import { BACKED_UP } from "./settingsRegistry";
import { sshStore, type SshProfile } from "./sshStore.svelte";
import { securityKeys } from "./securityKeys.svelte";

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
const texts = (raw: Wire, key: string): string[] | null =>
  Array.isArray(raw[key]) ? (raw[key] as unknown[]).filter((item): item is string => typeof item === "string") : null;

export interface BackupOptions {
  notes?: boolean;
}

export interface BackupCounts {
  environments: number;
  notes: number;
}

export const exportSettings = (options: BackupOptions = {}): string =>
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
        ...Object.fromEntries(BACKED_UP.map(({ key }) => [key, settings.exported(key)])),
        visibility: settings.visibility,
      },
      shortcuts: shortcuts.custom,
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
        ...(securityKeys.keyFor(profile) ? { security_key: securityKeys.keyFor(profile) } : {}),
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
      ...(options.notes
        ? {
            notes: notes.items
              .filter((note) => !note.deletedAt)
              .map((note) => ({
                id: note.id,
                ...(note.title ? { title: note.title } : {}),
                body: note.body,
                updated_at: note.updatedAt,
              })),
          }
        : {}),
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

  const readers = { boolean: flag, number, string: text, strings: texts } as const;
  for (const { key, kind } of BACKED_UP) {
    const value = readers[kind](values, key);
    if (value !== null) settings.adopt(key, value);
  }

  const visibility = values.visibility;
  if (visibility && typeof visibility === "object") {
    settings.visibility = { ...settings.visibility, ...(visibility as VisibilityPrefs) };
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

const toNote = (raw: Wire): Note | null => {
  const id = text(raw, "id");
  if (!id) return null;
  return {
    id,
    title: text(raw, "title") ?? undefined,
    body: text(raw, "body") ?? "",
    updatedAt: number(raw, "updated_at") ?? Date.now(),
  };
};

interface Backup {
  values: Wire | null;
  environments: EnvironmentProfile[];
  keys: Array<[EnvironmentProfile, string]>;
  bindings: Array<[string, string]>;
  active: string;
  ssh: SshProfile[];
  notes: Note[] | null;
}

const parsed = (raw: string): Wire | null => {
  try {
    const root = JSON.parse(raw) as Wire | null;
    return root && typeof root === "object" && text(root, "app") === APP ? root : null;
  } catch {
    return null;
  }
};

const readBackup = (raw: string): Backup | null => {
  const root = parsed(raw);
  if (!root) return null;

  const environments = list(root, "environments");
  const bindings = root.shortcuts;
  return {
    values: root.settings && typeof root.settings === "object" ? (root.settings as Wire) : null,
    environments: environments.map(toEnvironment).filter((profile): profile is EnvironmentProfile => profile !== null),
    keys: environments.flatMap((entry) => {
      const profile = toEnvironment(entry);
      const key = text(entry, "security_key");
      return profile && key ? [[profile, key] as [EnvironmentProfile, string]] : [];
    }),
    bindings:
      bindings && typeof bindings === "object"
        ? Object.entries(bindings as Wire).flatMap(([id, keys]) =>
            typeof keys === "string" ? [[id, keys] as [string, string]] : [],
          )
        : [],
    active: text(root, "active_environment") ?? "",
    ssh: list(root, "ssh")
      .map(toSshProfile)
      .filter((profile): profile is SshProfile => profile !== null),
    notes: "notes" in root ? list(root, "notes").map(toNote).filter((note): note is Note => note !== null) : null,
  };
};

export const backupCounts = (raw: string): BackupCounts => {
  const backup = readBackup(raw);
  return { environments: backup?.environments.length ?? 0, notes: backup?.notes?.length ?? 0 };
};

export const importSettings = (raw: string): boolean => {
  const backup = readBackup(raw);
  if (!backup) return false;

  if (backup.values) applySettings(backup.values);
  if (backup.environments.length) backend.save(backup.environments);
  for (const [profile, key] of backup.keys) securityKeys.setFor(profile, key);
  for (const [id, keys] of backup.bindings) shortcuts.set(id, keys);
  if (backup.active) backend.select(backup.active);
  if (backup.ssh.length) sshStore.replaceAll(backup.ssh);
  if (backup.notes) notes.replaceAll(backup.notes);

  return true;
};
