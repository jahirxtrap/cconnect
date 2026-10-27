import { store } from "$lib/platform/storage";
import { CLIENT_DEFAULTS, CLIENT_SETTINGS, LEGACY_KEYS } from "./settingsRegistry";

export interface VisibilityPrefs {
  simple: boolean | null;
  tokens: boolean | null;
  timings: boolean | null;
  thinking: string | null;
  tool_use: string | null;
  file_change: string | null;
  compact: string | null;
  working: string | null;
}

export interface BrowserShield {
  enabled: boolean;
  lists: string[];
  allowed: string[];
}

export interface BrowserProxy {
  mode: string;
  url: string;
  bypass: string;
}

export interface BrowserFavorite {
  url: string;
  title: string;
  icon: string;
}

const favoriteOf = (value: unknown): BrowserFavorite | null => {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  if (typeof item.url !== "string" || !item.url) return null;
  return {
    url: item.url,
    title: typeof item.title === "string" ? item.title : "",
    icon: typeof item.icon === "string" ? item.icon : "",
  };
};

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
      Object.entries(CLIENT_DEFAULTS).map(([key, fallback]) => {
        const legacy = LEGACY_KEYS.get(key);
        return [key, store.get(key, legacy ? store.get(legacy, fallback) : fallback)];
      }),
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
    const timings = this.#read<string>("visibility_timings");
    return {
      simple: simple === "" ? null : simple === "on",
      tokens: tokens === "" ? null : tokens === "on",
      timings: timings === "" ? null : timings === "on",
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
    this.#write("visibility_timings", value.timings === null ? "" : value.timings ? "on" : "off");
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

  get codeLineNumbers() {
    return this.#read<boolean>("code_line_numbers");
  }
  set codeLineNumbers(value: boolean) {
    this.#write("code_line_numbers", value);
  }

  get projectDiff() {
    return this.#read<boolean>("project_diff");
  }
  set projectDiff(value: boolean) {
    this.#write("project_diff", value);
  }

  get projectChangedOnly() {
    return this.#read<boolean>("project_changed_only");
  }
  set projectChangedOnly(value: boolean) {
    this.#write("project_changed_only", value);
  }

  get viewInCenter() {
    return this.#read<boolean>("view_in_center");
  }
  set viewInCenter(value: boolean) {
    this.#write("view_in_center", value);
  }

  get chatViewFull() {
    return this.#read<boolean>("chat_view_full");
  }
  set chatViewFull(value: boolean) {
    this.#write("chat_view_full", value);
  }

  get projectCommitOpen() {
    return this.#read<boolean>("project_commit_open");
  }
  set projectCommitOpen(value: boolean) {
    this.#write("project_commit_open", value);
  }

  get projectCommitHeight() {
    return this.#read<number>("project_commit_height");
  }
  set projectCommitHeight(value: number) {
    this.#write("project_commit_height", value);
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

  get paneBar(): string[] {
    return this.#list("pane_bar");
  }
  set paneBar(value: string[]) {
    this.#write("pane_bar", value.join(","));
  }

  get paneMenu(): string[] {
    return this.#list("pane_menu");
  }
  set paneMenu(value: string[]) {
    this.#write("pane_menu", value.join(","));
  }

  get minimizeToTray() {
    return this.#read<boolean>("minimize_to_tray");
  }
  set minimizeToTray(value: boolean) {
    this.#write("minimize_to_tray", value);
  }

  get modBandHandle() {
    return this.#read<boolean>("mod_band_handle");
  }
  set modBandHandle(value: boolean) {
    this.#write("mod_band_handle", value);
  }

  get browserShield(): BrowserShield {
    return {
      enabled: this.#read<boolean>("browser_adblock"),
      lists: this.#list("browser_adblock_lists"),
      allowed: this.#list("browser_adblock_allowed"),
    };
  }
  set browserShield(value: BrowserShield) {
    this.#write("browser_adblock", value.enabled);
    this.#write("browser_adblock_lists", value.lists.join(","));
    this.#write("browser_adblock_allowed", value.allowed.join(","));
  }

  get browserProxy(): BrowserProxy {
    return {
      mode: this.#read<string>("browser_proxy"),
      url: this.#read<string>("browser_proxy_url"),
      bypass: this.#read<string>("browser_proxy_bypass"),
    };
  }
  set browserProxy(value: BrowserProxy) {
    this.#write("browser_proxy", value.mode);
    this.#write("browser_proxy_url", value.url);
    this.#write("browser_proxy_bypass", value.bypass);
  }

  get browserViewport() {
    return this.#read<string>("browser_viewport");
  }
  set browserViewport(value: string) {
    this.#write("browser_viewport", value);
  }

  get browserZoom(): Record<string, number> {
    const value = this.#read<unknown>("browser_zoom");
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return Object.fromEntries(Object.entries(value).filter(([, zoom]) => typeof zoom === "number"));
  }
  set browserZoom(value: Record<string, number>) {
    this.#write("browser_zoom", value);
  }

  get browserFavorites(): BrowserFavorite[] {
    const value = this.#read<unknown>("browser_favorites");
    return Array.isArray(value) ? value.map(favoriteOf).filter((item): item is BrowserFavorite => item !== null) : [];
  }
  set browserFavorites(value: BrowserFavorite[]) {
    this.#write("browser_favorites", value);
  }

  get modBandHidden() {
    return this.#read<boolean>("mod_band_hidden");
  }
  set modBandHidden(value: boolean) {
    this.#write("mod_band_hidden", value);
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

  get agentPane() {
    return this.#read<string>("agent_pane");
  }
  set agentPane(value: string) {
    this.#write("agent_pane", value);
  }

  get sharedSortField() {
    return this.#read<string>("shared_sort_field");
  }
  set sharedSortField(value: string) {
    this.#write("shared_sort_field", value);
  }

  get sharedHiddenKinds(): string[] {
    return this.#list("shared_hidden_kinds");
  }
  set sharedHiddenKinds(value: string[]) {
    this.#write("shared_hidden_kinds", value.join(","));
  }

  get sharedSortAscending() {
    return this.#read<boolean>("shared_sort_ascending");
  }
  set sharedSortAscending(value: boolean) {
    this.#write("shared_sort_ascending", value);
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

  get localServerSource() {
    return this.#read<string>("local_server_source") || (this.localServerDir ? "python" : "native");
  }
  set localServerSource(value: string) {
    this.#write("local_server_source", value);
  }

  get localServerCommandPath() {
    return this.#read<string>("local_server_command_path");
  }
  set localServerCommandPath(value: string) {
    this.#write("local_server_command_path", value);
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

  get lockedProject() {
    return this.#read<string>("locked_project");
  }
  set lockedProject(value: string) {
    this.#write("locked_project", value);
  }

  get skippedRelease() {
    return this.#read<string>("skipped_release");
  }
  set skippedRelease(value: string) {
    this.#write("skipped_release", value);
  }
}

export const settings = new Settings();
