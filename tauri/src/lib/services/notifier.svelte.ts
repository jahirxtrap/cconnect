import { isTauri } from "$lib/platform";

export type NotificationKind = "task_done" | "interaction";

class Notifier {
  granted = $state(false);

  #foreground = true;
  #pendingTab: string | null = null;
  #activate: ((tabId: string | null) => void) | null = null;

  start(onActivate: (tabId: string | null) => void) {
    this.#activate = onActivate;
    const update = () => (this.#foreground = document.visibilityState === "visible" && document.hasFocus());
    update();
    document.addEventListener("visibilitychange", update);
    window.addEventListener("focus", () => {
      update();
      void this.refresh();
    });
    window.addEventListener("blur", update);
    void this.requestPermission();
    void this.#listenForTaps();
  }

  async notify(title: string, body: string | null, targetTab: string | null = null) {
    if (this.#foreground || !this.granted) return;
    this.#pendingTab = targetTab;
    if (isTauri) {
      const { sendNotification } = await import("@tauri-apps/plugin-notification");
      sendNotification({ title, body: body ?? undefined });
      return;
    }
    const notification = new Notification(title, { body: body ?? undefined });
    notification.onclick = () => {
      window.focus();
      notification.close();
      this.#open();
    };
  }

  async refresh() {
    if (isTauri) {
      const { isPermissionGranted } = await import("@tauri-apps/plugin-notification");
      this.granted = await isPermissionGranted();
      return;
    }
    if ("Notification" in window) this.granted = Notification.permission === "granted";
  }

  async requestPermission() {
    if (isTauri) {
      const { isPermissionGranted, requestPermission } = await import("@tauri-apps/plugin-notification");
      this.granted = (await isPermissionGranted()) || (await requestPermission()) === "granted";
      return;
    }
    if (!("Notification" in window)) return;
    if (Notification.permission === "granted") this.granted = true;
    else if (Notification.permission !== "denied") this.granted = (await Notification.requestPermission()) === "granted";
  }

  // Only a tap on the notification jumps to its tab; regaining focus on your own must not.
  #open() {
    const tab = this.#pendingTab;
    this.#pendingTab = null;
    if (tab !== null) this.#activate?.(tab);
  }

  async #listenForTaps() {
    if (!isTauri) return;
    const { onAction } = await import("@tauri-apps/plugin-notification");
    try {
      await onAction(() => {
        void this.#focusWindow();
        this.#open();
      });
    } catch {
      return;
    }
  }

  async #focusWindow() {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    const current = getCurrentWindow();
    await current.show();
    await current.unminimize();
    await current.setFocus();
  }
}

export const notifier = new Notifier();
