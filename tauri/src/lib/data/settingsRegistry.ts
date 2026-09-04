export type SettingKind = "boolean" | "number" | "string" | "strings";

export interface ClientSetting {
  key: string;
  kind: SettingKind;
  fallback: string | number | boolean;
  backup: boolean;
}

export const CLIENT_SETTINGS: ClientSetting[] = [
  { key: "notify_task_done", kind: "boolean", fallback: false, backup: true },
  { key: "notify_interaction", kind: "boolean", fallback: true, backup: true },
  { key: "markdown_preview_formatted", kind: "boolean", fallback: true, backup: true },
  { key: "show_timestamps", kind: "boolean", fallback: false, backup: true },
  { key: "minimize_to_tray", kind: "boolean", fallback: false, backup: true },
  { key: "environment_locked", kind: "boolean", fallback: false, backup: true },
  { key: "project_locked", kind: "boolean", fallback: false, backup: true },
  { key: "collapsed_categories", kind: "strings", fallback: "", backup: true },
  { key: "hidden_categories", kind: "strings", fallback: "", backup: true },
  { key: "hidden_projects", kind: "strings", fallback: "", backup: true },
  { key: "file_sort_field", kind: "string", fallback: "date", backup: true },
  { key: "file_sort_ascending", kind: "boolean", fallback: false, backup: true },
  { key: "local_server_enabled", kind: "boolean", fallback: false, backup: true },
  { key: "local_server_dir", kind: "string", fallback: "", backup: true },
  { key: "local_server_python", kind: "string", fallback: "auto", backup: true },
  { key: "local_server_python_path", kind: "string", fallback: "", backup: true },
  { key: "local_server_mode", kind: "string", fallback: "local", backup: true },
  { key: "local_server_public_host", kind: "string", fallback: "", backup: true },
  { key: "left_width", kind: "number", fallback: 300, backup: true },
  { key: "right_width", kind: "number", fallback: 420, backup: true },
  { key: "left_expanded", kind: "boolean", fallback: true, backup: false },
  { key: "tabs_state", kind: "string", fallback: "", backup: false },
  { key: "right_pane", kind: "string", fallback: "", backup: false },
  { key: "visibility_simple", kind: "string", fallback: "", backup: false },
  { key: "visibility_tokens", kind: "string", fallback: "", backup: false },
  { key: "visibility_thinking", kind: "string", fallback: "", backup: false },
  { key: "visibility_tool_use", kind: "string", fallback: "", backup: false },
  { key: "visibility_file_change", kind: "string", fallback: "", backup: false },
  { key: "visibility_compact", kind: "string", fallback: "", backup: false },
  { key: "visibility_working", kind: "string", fallback: "", backup: false },
];

export const BACKED_UP = CLIENT_SETTINGS.filter((setting) => setting.backup);

export const CLIENT_DEFAULTS = Object.fromEntries(
  CLIENT_SETTINGS.map((setting) => [setting.key, setting.fallback]),
);
