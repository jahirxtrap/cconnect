import { store } from "$lib/platform/storage";
import { CLIENT_DEFAULTS, CLIENT_SETTINGS } from "./settingsRegistry";

export interface VisibilityPrefs {
  simple: boolean | null;
  tokens: boolean | null;
  thinking: string | null;
  tool_use: string | null;
  file_change: string | null;
  compact: string | null;
  working: string | null;
}

export interface DiscordPrefs {
  enabled: boolean;
  status: boolean;
  time: boolean;
  model: boolean;
  environment: boolean;
  project: boolean;
  chatTitle: boolean;
  hideIdle: boolean;
}

const DISCORD_KEYS: Record<keyof DiscordPrefs, string> = {
  enabled: "discord_presence",
  status: "discord_status",
  time: "discord_time",
  model: "discord_model",
  environment: "discord_environment",
  project: "discord_project",
  chatTitle: "discord_chat_title",
  hideIdle: "discord_hide_idle",
};

const KINDS = new Map(CLIENT_SETTINGS.map((setting) => [setting.key, setting.kind]));

class Settings {
  #values = $state<Record<string, unknown>>(
    Object.fromEntries(
      Object.entries(CLIENT_DEFAULTS).map(([key, fallback]) => [key, store.get(key, fallback)]),
    ),
  );

  #read<T>(key: string): T {
    return this.#values[key] as T;
  }

  #write(key: string, value: unknown) {
    this.#values[key] = value;
    store.set(key, value);
  }

  #list(key: string): string[] {
    return this.#read<string>(key).split(",").filter(Boolean);
  }

  exported(key: string): unknown {
    return KINDS.get(key) === "strings" ? this.#list(key) : this.#values[key];
  }

  adopt(key: string, value: unknown): void {
    this.#write(key, KINDS.get(key) === "strings" ? (value as string[]).join(",") : value);
  }

  get visibility(): VisibilityPrefs {
    const simple = this.#read<string>("visibility_simple");
    const tokens = this.#read<string>("visibility_tokens");
    return {
      simple: simple === "" ? null : simple === "on",
      tokens: tokens === "" ? null : tokens === "on",
      thinking: this.#read<string>("visibility_thinking") || null,
      tool_use: this.#read<string>("visibility_tool_use") || null,
      file_change: this.#read<string>("visibility_file_change") || null,
      compact: this.#read<string>("visibility_compact") || null,
      working: this.#read<string>("visibility_working") || null,
    };
  }

  set visibility(value: VisibilityPrefs) {
    this.#write("visibility_simple", value.simple === null ? "" : value.simple ? "on" : "off");
    this.#write("visibility_tokens", value.tokens === null ? "" : value.tokens ? "on" : "off");
    this.#write("visibility_thinking", value.thinking ?? "");
    this.#write("visibility_tool_use", value.tool_use ?? "");
    this.#write("visibility_file_change", value.file_change ?? "");
    this.#write("visibility_compact", value.compact ?? "");
    this.#write("visibility_working", value.working ?? "");
  }

  get notifyTaskDone() {
    return this.#read<boolean>("notify_task_done");
  }
  set notifyTaskDone(value: boolean) {
    this.#write("notify_task_done", value);
  }

  get notifyInteraction() {
    return this.#read<boolean>("notify_interaction");
  }
  set notifyInteraction(value: boolean) {
    this.#write("notify_interaction", value);
  }

  get markdownPreviewFormatted() {
    return this.#read<boolean>("markdown_preview_formatted");
  }
  set markdownPreviewFormatted(value: boolean) {
    this.#write("markdown_preview_formatted", value);
  }

  get showTimestamps() {
    return this.#read<boolean>("show_timestamps");
  }
  set showTimestamps(value: boolean) {
    this.#write("show_timestamps", value);
  }

  get collapsedCategories(): string[] {
    return this.#list("collapsed_categories");
  }
  set collapsedCategories(value: string[]) {
    this.#write("collapsed_categories", value.join(","));
  }

  get hiddenCategories(): string[] {
    return this.#list("hidden_categories");
  }
  set hiddenCategories(value: string[]) {
    this.#write("hidden_categories", value.join(","));
  }

  get hiddenProjects(): string[] {
    return this.#list("hidden_projects");
  }
  set hiddenProjects(value: string[]) {
    this.#write("hidden_projects", value.join(","));
  }

  get leftExpanded() {
    return this.#read<boolean>("left_expanded");
  }
  set leftExpanded(value: boolean) {
    this.#write("left_expanded", value);
  }

  get leftWidth() {
    return this.#read<number>("left_width");
  }
  set leftWidth(value: number) {
    this.#write("left_width", value);
  }

  get rightWidth() {
    return this.#read<number>("right_width");
  }
  set rightWidth(value: number) {
    this.#write("right_width", value);
  }

  get minimizeToTray() {
    return this.#read<boolean>("minimize_to_tray");
  }
  set minimizeToTray(value: boolean) {
    this.#write("minimize_to_tray", value);
  }

  get discord(): DiscordPrefs {
    return {
      enabled: this.#read<boolean>("discord_presence"),
      status: this.#read<boolean>("discord_status"),
      time: this.#read<boolean>("discord_time"),
      model: this.#read<boolean>("discord_model"),
      environment: this.#read<boolean>("discord_environment"),
      project: this.#read<boolean>("discord_project"),
      chatTitle: this.#read<boolean>("discord_chat_title"),
      hideIdle: this.#read<boolean>("discord_hide_idle"),
    };
  }

  setDiscord<K extends keyof DiscordPrefs>(field: K, value: boolean) {
    this.#write(DISCORD_KEYS[field], value);
  }

  get tabsState() {
    return this.#read<string>("tabs_state");
  }
  set tabsState(value: string) {
    this.#write("tabs_state", value);
  }

  get rightPane() {
    return this.#read<string>("right_pane");
  }
  set rightPane(value: string) {
    this.#write("right_pane", value);
  }

  get fileSortField() {
    return this.#read<string>("file_sort_field");
  }
  set fileSortField(value: string) {
    this.#write("file_sort_field", value);
  }

  get fileSortAscending() {
    return this.#read<boolean>("file_sort_ascending");
  }
  set fileSortAscending(value: boolean) {
    this.#write("file_sort_ascending", value);
  }

  get localServerEnabled() {
    return this.#read<boolean>("local_server_enabled");
  }
  set localServerEnabled(value: boolean) {
    this.#write("local_server_enabled", value);
  }

  get localServerDir() {
    return this.#read<string>("local_server_dir");
  }
  set localServerDir(value: string) {
    this.#write("local_server_dir", value);
  }

  get localServerPython() {
    return this.#read<string>("local_server_python");
  }
  set localServerPython(value: string) {
    this.#write("local_server_python", value);
  }

  get localServerPythonPath() {
    return this.#read<string>("local_server_python_path");
  }
  set localServerPythonPath(value: string) {
    this.#write("local_server_python_path", value);
  }

  get localServerMode() {
    return this.#read<string>("local_server_mode");
  }
  set localServerMode(value: string) {
    this.#write("local_server_mode", value);
  }

  get localServerPublicHost() {
    return this.#read<string>("local_server_public_host");
  }
  set localServerPublicHost(value: string) {
    this.#write("local_server_public_host", value);
  }

  get environmentLocked() {
    return this.#read<boolean>("environment_locked");
  }
  set environmentLocked(value: boolean) {
    this.#write("environment_locked", value);
  }

  get projectLocked() {
    return this.#read<boolean>("project_locked");
  }
  set projectLocked(value: boolean) {
    this.#write("project_locked", value);
  }
}

export const settings = new Settings();
