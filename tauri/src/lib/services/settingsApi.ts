import { http, type HttpClient } from "./http";

export interface SettingsSnapshot {
  account: string;
  model: string;
  effort: string;
  permissionMode: string;
  streaming: boolean;
  showThinking: string;
  showToolUse: string;
  showFileChange: string;
  showCompact: string;
  showWorking: string;
}

export interface SettingsPatch {
  account?: string;
  model?: string;
  effort?: string;
  permission_mode?: string;
  streaming?: boolean;
  show_thinking?: string;
  show_tool_use?: string;
  show_file_change?: string;
  show_compact?: string;
  show_working?: string;
}

type Field = { effective?: unknown };
type Wire = Record<string, Field | undefined>;

const effectiveStr = (wire: Wire, key: string, fallback: string): string =>
  typeof wire[key]?.effective === "string" ? (wire[key]!.effective as string) : fallback;

const effectiveBool = (wire: Wire, key: string, fallback: boolean): boolean =>
  typeof wire[key]?.effective === "boolean" ? (wire[key]!.effective as boolean) : fallback;

const parse = (wire: Wire): SettingsSnapshot => ({
  account: effectiveStr(wire, "account", ""),
  model: effectiveStr(wire, "model", "opus"),
  effort: effectiveStr(wire, "effort", "xhigh"),
  permissionMode: effectiveStr(wire, "permission_mode", "bypassPermissions"),
  streaming: effectiveBool(wire, "streaming", true),
  showThinking: effectiveStr(wire, "show_thinking", "full"),
  showToolUse: effectiveStr(wire, "show_tool_use", "label"),
  showFileChange: effectiveStr(wire, "show_file_change", "full"),
  showCompact: effectiveStr(wire, "show_compact", "full"),
  showWorking: effectiveStr(wire, "show_working", "label"),
});

export const createSettingsApi = (http: HttpClient) => ({
  async get(): Promise<SettingsSnapshot | null> {
    const data = await http.get<Wire>("/settings");
    return data && parse(data);
  },

  async update(patch: SettingsPatch): Promise<SettingsSnapshot | null> {
    const data = await http.post<Wire>("/settings", patch);
    return data && parse(data);
  },

  async reset(): Promise<SettingsSnapshot | null> {
    const data = await http.post<Wire>("/settings/reset");
    return data && parse(data);
  },
});

export const settingsApi = createSettingsApi(http);
