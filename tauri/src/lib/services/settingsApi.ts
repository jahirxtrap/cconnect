import { http, type HttpClient } from "./http";
import { serverDefaults } from "$lib/data/serverDefaults.svelte";

export interface SettingsSnapshot {
  account: string;
  model: string;
  effort: string;
  permissionMode: string;
  streaming: boolean;
  todoTools: boolean;
  browserView: boolean;
  sdkAutoUpdate: boolean;
  outputStyle: string;
  mcpDisabled: string;
  showThinking: string;
  showToolUse: string;
  showFileChange: string;
  showCompact: string;
  showWorking: string;
  showTokens: boolean;
  simpleMode: boolean;
  chatOrder: string;
  trashEnabled: boolean;
  defaultCategory: string;
  retentionDays: number;
  retentionMin: number;
  retentionMax: number;
  chatLanguage: string;
  alwaysThinking: boolean;
  autoCompact: boolean;
  remoteControl: boolean | null;
  coAuthored: boolean | null;
  sessionUpload: boolean | null;
}

export interface SettingsPatch {
  account?: string;
  model?: string;
  effort?: string;
  permission_mode?: string;
  streaming?: boolean;
  todo_tools?: boolean;
  browser_view?: boolean;
  sdk_auto_update?: boolean;
  output_style?: string;
  mcp_disabled?: string;
  show_thinking?: string;
  show_tool_use?: string;
  show_file_change?: string;
  show_compact?: string;
  show_working?: string;
  show_tokens?: boolean;
  simple_mode?: boolean;
  chat_order?: string;
  trash_enabled?: boolean;
  default_category?: string;
  retention_days?: number;
  chat_language?: string;
  always_thinking?: boolean;
  auto_compact?: boolean;
  remote_control?: boolean | null;
  co_authored?: boolean | null;
  session_upload?: boolean | null;
}

export const RETENTION_FOREVER_DAYS = 36500;

type Field = { effective?: unknown; default?: unknown; minimum?: unknown; maximum?: unknown };
type Wire = Record<string, Field | undefined>;

const boundNum = (wire: Wire, key: string, bound: "minimum" | "maximum", fallback: number): number =>
  typeof wire[key]?.[bound] === "number" ? (wire[key]![bound] as number) : fallback;

const effective = <T>(wire: Wire, key: string, kind: string, fallback: T): T => {
  const field = wire[key];
  if (!field) return fallback;
  if (typeof field.effective === kind) return field.effective as T;
  if (typeof field.default === kind) return field.default as T;
  return fallback;
};

const effectiveStr = (wire: Wire, key: string, fallback: string): string =>
  effective(wire, key, "string", fallback);

const effectiveBool = (wire: Wire, key: string, fallback: boolean): boolean =>
  effective(wire, key, "boolean", fallback);

const effectiveFlag = (wire: Wire, key: string): boolean | null =>
  typeof wire[key]?.effective === "boolean" ? (wire[key]!.effective as boolean) : null;

const effectiveNum = (wire: Wire, key: string, fallback: number): number =>
  effective(wire, key, "number", fallback);

const parse = (wire: Wire): SettingsSnapshot => ({
  account: effectiveStr(wire, "account", ""),
  model: effectiveStr(wire, "model", "opus"),
  effort: effectiveStr(wire, "effort", "xhigh"),
  permissionMode: effectiveStr(wire, "permission_mode", "bypassPermissions"),
  streaming: effectiveBool(wire, "streaming", true),
  todoTools: effectiveBool(wire, "todo_tools", false),
  browserView: effectiveBool(wire, "browser_view", false),
  sdkAutoUpdate: effectiveBool(wire, "sdk_auto_update", true),
  outputStyle: effectiveStr(wire, "output_style", "default"),
  mcpDisabled: effectiveStr(wire, "mcp_disabled", ""),
  showThinking: effectiveStr(wire, "show_thinking", "full"),
  showToolUse: effectiveStr(wire, "show_tool_use", "label"),
  showFileChange: effectiveStr(wire, "show_file_change", "full"),
  showCompact: effectiveStr(wire, "show_compact", "full"),
  showWorking: effectiveStr(wire, "show_working", "label"),
  showTokens: effectiveBool(wire, "show_tokens", false),
  simpleMode: effectiveBool(wire, "simple_mode", false),
  chatOrder: effectiveStr(wire, "chat_order", "auto"),
  trashEnabled: effectiveBool(wire, "trash_enabled", false),
  defaultCategory: effectiveStr(wire, "default_category", ""),
  retentionDays: effectiveNum(wire, "retention_days", 30),
  retentionMin: boundNum(wire, "retention_days", "minimum", 1),
  retentionMax: boundNum(wire, "retention_days", "maximum", Number.MAX_SAFE_INTEGER),
  chatLanguage: effectiveStr(wire, "chat_language", ""),
  alwaysThinking: effectiveBool(wire, "always_thinking", false),
  autoCompact: effectiveBool(wire, "auto_compact", true),
  remoteControl: effectiveFlag(wire, "remote_control"),
  coAuthored: effectiveFlag(wire, "co_authored"),
  sessionUpload: effectiveFlag(wire, "session_upload"),
});

export const createSettingsApi = (http: HttpClient) => ({
  async get(): Promise<SettingsSnapshot | null> {
    const data = await http.get<Wire>("/settings");
    return data && parse(data);
  },

  async update(patch: SettingsPatch): Promise<SettingsSnapshot | null> {
    const data = await http.post<Wire>("/settings", patch);
    if (data) serverDefaults.bump();
    return data && parse(data);
  },

  async reset(): Promise<SettingsSnapshot | null> {
    const data = await http.post<Wire>("/settings/reset");
    if (data) serverDefaults.bump();
    return data && parse(data);
  },
});

export const settingsApi = createSettingsApi(http);
