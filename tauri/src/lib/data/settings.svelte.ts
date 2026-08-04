import { store } from "$lib/platform/storage";

const DEFAULTS = {
  notify_task_done: false,
  notify_interaction: true,
  markdown_preview_formatted: true,
  show_timestamps: false,
  sidebar_expanded: false,
  minimize_to_tray: false,
  cwd: "",
  tabs_state: "",
  file_sort_field: "date",
  file_sort_ascending: false,
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

  get sidebarExpanded() {
    return this.#read("sidebar_expanded");
  }
  set sidebarExpanded(value: boolean) {
    this.#write("sidebar_expanded", value);
  }

  get minimizeToTray() {
    return this.#read("minimize_to_tray");
  }
  set minimizeToTray(value: boolean) {
    this.#write("minimize_to_tray", value);
  }

  get cwd() {
    return this.#read("cwd");
  }
  set cwd(value: string) {
    this.#write("cwd", value);
  }

  get tabsState() {
    return this.#read("tabs_state");
  }
  set tabsState(value: string) {
    this.#write("tabs_state", value);
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
}

export const settings = new Settings();
