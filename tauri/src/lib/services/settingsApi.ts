import { http, type HttpClient } from "./http";
import { serverDefaults } from "$lib/data/serverDefaults.svelte";

export interface SettingsSnapshot {
  account: string;
  model: string;
  effort: string;
  permissionMode: string;
  streaming: boolean;
  todoTools: boolean;
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
}

export interface SettingsPatch {
  account?: string;
  model?: string;
  effort?: string;
  permission_mode?: string;
  streaming?: boolean;
  todo_tools?: boolean;
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
}

type Field = { effective?: unknown };
type Wire = Record<string, Field | undefined>;

const effectiveStr = (wire: Wire, key: string, fallback: string): string =>
  typeof wire[key]?.effective === "string" ? (wire[key]!.effective as string) : fallback;

const effectiveBool = (wire: Wire, key: string, fallback: boolean): boolean =>
  typeof wire[key]?.effective === "boolean" ? (wire[key]!.effective as boolean) : fallback;

const effectiveNum = (wire: Wire, key: string, fallback: number): number =>
  typeof wire[key]?.effective === "number" ? (wire[key]!.effective as number) : fallback;

const parse = (wire: Wire): SettingsSnapshot => ({
  account: effectiveStr(wire, "account", ""),
  model: effectiveStr(wire, "model", "opus"),
  effort: effectiveStr(wire, "effort", "xhigh"),
  permissionMode: effectiveStr(wire, "permission_mode", "bypassPermissions"),
  streaming: effectiveBool(wire, "streaming", true),
  todoTools: effectiveBool(wire, "todo_tools", false),
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
