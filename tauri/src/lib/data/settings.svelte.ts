import { store } from "$lib/platform/storage";

class Settings {
  #cache = $state<Record<string, unknown>>({});

  #read<T>(key: string, fallback: T): T {
    if (!(key in this.#cache)) this.#cache[key] = store.get(key, fallback);
    return this.#cache[key] as T;
  }

  #write<T>(key: string, value: T) {
    this.#cache[key] = value;
    store.set(key, value);
  }

  get notifyTaskDone() {
    return this.#read("notify_task_done", false);
  }
  set notifyTaskDone(value: boolean) {
    this.#write("notify_task_done", value);
  }

  get notifyInteraction() {
    return this.#read("notify_interaction", true);
  }
  set notifyInteraction(value: boolean) {
    this.#write("notify_interaction", value);
  }

  get markdownPreviewFormatted() {
    return this.#read("markdown_preview_formatted", true);
  }
  set markdownPreviewFormatted(value: boolean) {
    this.#write("markdown_preview_formatted", value);
  }

  get showTimestamps() {
    return this.#read("show_timestamps", false);
  }
  set showTimestamps(value: boolean) {
    this.#write("show_timestamps", value);
  }

  get sidebarExpanded() {
    return this.#read("sidebar_expanded", false);
  }
  set sidebarExpanded(value: boolean) {
    this.#write("sidebar_expanded", value);
  }

  get minimizeToTray() {
    return this.#read("minimize_to_tray", false);
  }
  set minimizeToTray(value: boolean) {
    this.#write("minimize_to_tray", value);
  }

  get cwd() {
    return this.#read("cwd", "");
  }
  set cwd(value: string) {
    this.#write("cwd", value);
  }

  get tabsState() {
    return this.#read("tabs_state", "");
  }
  set tabsState(value: string) {
    this.#write("tabs_state", value);
  }

  get fileSortField() {
    return this.#read("file_sort_field", "date");
  }
  set fileSortField(value: string) {
    this.#write("file_sort_field", value);
  }

  get fileSortAscending() {
    return this.#read("file_sort_ascending", false);
  }
  set fileSortAscending(value: boolean) {
    this.#write("file_sort_ascending", value);
  }
}

export const settings = new Settings();
