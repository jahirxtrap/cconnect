import { store } from "$lib/platform/storage";

export interface VisibilityPrefs {
  simple: boolean | null;
  tokens: boolean | null;
  thinking: string | null;
  tool_use: string | null;
  file_change: string | null;
  compact: string | null;
  working: string | null;
}

const DEFAULTS = {
  notify_task_done: false,
  notify_interaction: true,
  markdown_preview_formatted: true,
  show_timestamps: false,
  left_expanded: true,
  left_width: 300,
  terminal_open: false,
  right_width: 420,
  minimize_to_tray: false,
  tabs_state: "",
  right_pane: "",
  collapsed_categories: "",
  hidden_categories: "",
  hidden_projects: "",
  file_sort_field: "date",
  file_sort_ascending: false,
  local_server_enabled: false,
  local_server_dir: "",
  local_server_python: "auto",
  local_server_python_path: "",
  local_server_mode: "local",
  local_server_public_host: "",
  window_maximized: true,
  window_bounds: "",
  dynamic_color: false,
  environment_locked: false,
  project_locked: false,
  visibility_simple: "",
  visibility_tokens: "",
  visibility_thinking: "",
  visibility_tool_use: "",
  visibility_file_change: "",
  visibility_compact: "",
  visibility_working: "",
};

type Key = keyof typeof DEFAULTS;

class Settings {
  #values = $state<Record<string, unknown>>(
    Object.fromEntries(Object.entries(DEFAULTS).map(([key, fallback]) => [key, store.get(key, fallback)])),
  );

  #read<K extends Key>(key: K): (typeof DEFAULTS)[K] {
    return this.#values[key] as (typeof DEFAULTS)[K];
  }

  #write<K extends Key>(key: K, value: (typeof DEFAULTS)[K]) {
    this.#values[key] = value;
    store.set(key, value);
  }

  get visibility(): VisibilityPrefs {
    const simple = this.#read("visibility_simple");
    const tokens = this.#read("visibility_tokens");
    return {
      simple: simple === "" ? null : simple === "on",
      tokens: tokens === "" ? null : tokens === "on",
      thinking: this.#read("visibility_thinking") || null,
      tool_use: this.#read("visibility_tool_use") || null,
      file_change: this.#read("visibility_file_change") || null,
      compact: this.#read("visibility_compact") || null,
      working: this.#read("visibility_working") || null,
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
    return this.#read("notify_task_done");
  }
  set notifyTaskDone(value: boolean) {
    this.#write("notify_task_done", value);
  }

  get notifyInteraction() {
    return this.#read("notify_interaction");
  }
  set notifyInteraction(value: boolean) {
    this.#write("notify_interaction", value);
  }

  get markdownPreviewFormatted() {
    return this.#read("markdown_preview_formatted");
  }
  set markdownPreviewFormatted(value: boolean) {
    this.#write("markdown_preview_formatted", value);
  }

  get showTimestamps() {
    return this.#read("show_timestamps");
  }
  set showTimestamps(value: boolean) {
    this.#write("show_timestamps", value);
  }

  get collapsedCategories(): string[] {
    return this.#read("collapsed_categories").split(",").filter(Boolean);
  }
  set collapsedCategories(value: string[]) {
    this.#write("collapsed_categories", value.join(","));
  }

  get hiddenCategories(): string[] {
    return this.#read("hidden_categories").split(",").filter(Boolean);
  }
  set hiddenCategories(value: string[]) {
    this.#write("hidden_categories", value.join(","));
  }

  get hiddenProjects(): string[] {
    return this.#read("hidden_projects").split(",").filter(Boolean);
  }
  set hiddenProjects(value: string[]) {
    this.#write("hidden_projects", value.join(","));
  }

  get leftExpanded() {
    return this.#read("left_expanded");
  }
  set leftExpanded(value: boolean) {
    this.#write("left_expanded", value);
  }

  get leftWidth() {
    return this.#read("left_width");
  }
  set leftWidth(value: number) {
    this.#write("left_width", value);
  }

  get terminalOpen() {
    return this.#read("terminal_open");
  }
  set terminalOpen(value: boolean) {
    this.#write("terminal_open", value);
  }

  get rightWidth() {
    return this.#read("right_width");
  }
  set rightWidth(value: number) {
    this.#write("right_width", value);
  }

  get minimizeToTray() {
    return this.#read("minimize_to_tray");
  }
  set minimizeToTray(value: boolean) {
    this.#write("minimize_to_tray", value);
  }

  get tabsState() {
    return this.#read("tabs_state");
  }
  set tabsState(value: string) {
    this.#write("tabs_state", value);
  }

  get rightPane() {
    return this.#read("right_pane");
  }
  set rightPane(value: string) {
    this.#write("right_pane", value);
  }

  get fileSortField() {
    return this.#read("file_sort_field");
  }
  set fileSortField(value: string) {
    this.#write("file_sort_field", value);
  }

  get fileSortAscending() {
    return this.#read("file_sort_ascending");
  }
  set fileSortAscending(value: boolean) {
    this.#write("file_sort_ascending", value);
  }

  get localServerEnabled() {
    return this.#read("local_server_enabled");
  }
  set localServerEnabled(value: boolean) {
    this.#write("local_server_enabled", value);
  }

  get localServerDir() {
    return this.#read("local_server_dir");
  }
  set localServerDir(value: string) {
    this.#write("local_server_dir", value);
  }

  get localServerPython() {
    return this.#read("local_server_python");
  }
  set localServerPython(value: string) {
    this.#write("local_server_python", value);
  }

  get localServerPythonPath() {
    return this.#read("local_server_python_path");
  }
  set localServerPythonPath(value: string) {
    this.#write("local_server_python_path", value);
  }

  get localServerMode() {
    return this.#read("local_server_mode");
  }
  set localServerMode(value: string) {
    this.#write("local_server_mode", value);
  }

  get localServerPublicHost() {
    return this.#read("local_server_public_host");
  }
  set localServerPublicHost(value: string) {
    this.#write("local_server_public_host", value);
  }

  get windowMaximized() {
    return this.#read("window_maximized");
  }
  set windowMaximized(value: boolean) {
    this.#write("window_maximized", value);
  }

  get windowBounds() {
    return this.#read("window_bounds");
  }
  set windowBounds(value: string) {
    this.#write("window_bounds", value);
  }

  get dynamicColor() {
    return this.#read("dynamic_color");
  }
  set dynamicColor(value: boolean) {
    this.#write("dynamic_color", value);
  }

  get environmentLocked() {
    return this.#read("environment_locked");
  }
  set environmentLocked(value: boolean) {
    this.#write("environment_locked", value);
  }

  get projectLocked() {
    return this.#read("project_locked");
  }
  set projectLocked(value: boolean) {
    this.#write("project_locked", value);
  }
}

export const settings = new Settings();
