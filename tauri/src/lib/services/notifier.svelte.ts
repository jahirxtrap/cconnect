import { isMobile, isTauri } from "$lib/platform";
import { http } from "./http";

export type NotificationKind = "task_done" | "interaction";

export interface NotificationAction {
  label: string;
  requestId: string;
  optionId: string;
}

const ACTION_TYPE = "interaction";
const MAX_ACTIONS = 3;

class Notifier {
  granted = $state(false);

  #foreground = true;
  #pendingTab: string | null = null;
  #activate: ((tabId: string | null) => void) | null = null;
  #actions: NotificationAction[] = [];

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

  async notify(
    title: string,
    body: string | null,
    targetTab: string | null = null,
    actions: NotificationAction[] = [],
  ) {
    if (this.#foreground || !this.granted) return;
    this.#pendingTab = targetTab;
    if (isTauri) {
      const { registerActionTypes, sendNotification } = await import("@tauri-apps/plugin-notification");
      this.#actions = actions.slice(0, MAX_ACTIONS);
      if (isMobile && this.#actions.length) {
        await registerActionTypes([
          {
            id: ACTION_TYPE,
            actions: this.#actions.map((action, index) => ({ id: String(index), title: action.label })),
          },
        ]).catch(() => undefined);
      }
      sendNotification({
        title,
        body: body ?? undefined,
        ...(isMobile ? { icon: "ic_notification" } : {}),
        ...(isMobile && this.#actions.length ? { actionTypeId: ACTION_TYPE } : {}),
      });
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
      await onAction((notification) => {
        const actionId = (notification as { actionId?: string }).actionId;
        const chosen = actionId === undefined ? undefined : this.#actions[Number(actionId)];
        if (chosen) {
          this.#actions = [];
          void http.post("/chat/interaction", { id: chosen.requestId, option_id: chosen.optionId });
        }
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
