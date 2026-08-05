import { isTauri } from "$lib/platform";

export type NotificationKind = "task_done" | "interaction";

class Notifier {
  #foreground = true;
  #granted = false;
  #pendingTab: string | null = null;

  start(onActivate: (tabId: string | null) => void) {
    const update = () => (this.#foreground = document.visibilityState === "visible" && document.hasFocus());
    update();
    document.addEventListener("visibilitychange", update);
    window.addEventListener("focus", () => {
      update();
      const tab = this.#pendingTab;
      this.#pendingTab = null;
      if (tab !== null) onActivate(tab);
    });
    window.addEventListener("blur", update);
    void this.#requestPermission();
  }

  async notify(title: string, body: string | null, targetTab: string | null = null) {
    if (this.#foreground || !this.#granted) return;
    this.#pendingTab = targetTab;
    if (isTauri) {
      const { sendNotification } = await import("@tauri-apps/plugin-notification");
      sendNotification({ title, body: body ?? undefined });
      return;
    }
    new Notification(title, { body: body ?? undefined });
  }

  async #requestPermission() {
    if (isTauri) {
      const { isPermissionGranted, requestPermission } = await import("@tauri-apps/plugin-notification");
      this.#granted = (await isPermissionGranted()) || (await requestPermission()) === "granted";
      return;
    }
    if (!("Notification" in window)) return;
    if (Notification.permission === "granted") this.#granted = true;
    else if (Notification.permission !== "denied") this.#granted = (await Notification.requestPermission()) === "granted";
  }
}

export const notifier = new Notifier();
