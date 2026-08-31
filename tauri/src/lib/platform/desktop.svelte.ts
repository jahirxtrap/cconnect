import { navigation } from "$lib/app/navigation.svelte";
import { settings } from "$lib/data/settings.svelte";
import { t } from "$lib/i18n/index.svelte";
import { localServer } from "$lib/services/localServer.svelte";
import { isTauri } from "./index";

const TRAY_ID = "cconnect";

class Desktop {
  refreshTick = $state(0);

  #trayActive = false;

  async start() {
    if (!isTauri) return;
    await this.#window();
    await this.#tray();
    if (settings.localServerEnabled && settings.localServerDir) localServer.start();
  }

  async #window() {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    const current = getCurrentWindow();

    if (settings.windowMaximized) await current.maximize();

    void current.onCloseRequested(async (event) => {
      if (!settings.minimizeToTray || !this.#trayActive) return;
      event.preventDefault();
      await current.hide();
    });

    void current.onResized(async () => {
      settings.windowMaximized = await current.isMaximized();
    });

    window.addEventListener("keydown", (event) => {
      if (event.key === "F11") {
        event.preventDefault();
        void current.isFullscreen().then((value) => current.setFullscreen(!value));
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "r") {
        event.preventDefault();
        this.refreshTick++;
      }
    });

    const SIDE_BACK = 3;
    const SIDE_FORWARD = 4;

    window.addEventListener("mousedown", (event) => {
      if (event.button === SIDE_BACK || event.button === SIDE_FORWARD) event.preventDefault();
    });

    window.addEventListener("auxclick", (event) => {
      if (event.button === SIDE_BACK || event.button === SIDE_FORWARD) event.preventDefault();
    });

    window.addEventListener("mouseup", (event) => {
      if (event.button === SIDE_BACK) {
        event.preventDefault();
        navigation.back();
      } else if (event.button === SIDE_FORWARD) {
        event.preventDefault();
        window.history.forward();
      }
    });
  }

  async #tray() {
    const [{ TrayIcon }, { Menu }, { defaultWindowIcon }, { getCurrentWindow }] = await Promise.all([
      import("@tauri-apps/api/tray"),
      import("@tauri-apps/api/menu"),
      import("@tauri-apps/api/app"),
      import("@tauri-apps/api/window"),
    ]);

    const current = getCurrentWindow();
    const show = async () => {
      await current.show();
      await current.unminimize();
      await current.setFocus();
    };

    const menu = await Menu.new({
      items: [
        { id: "open", text: t("OPEN"), action: () => void show() },
        { id: "exit", text: t("TRAY_EXIT"), action: () => void current.destroy() },
      ],
    });

    await TrayIcon.removeById(TRAY_ID).catch(() => undefined);

    try {
      await TrayIcon.new({
        id: TRAY_ID,
        icon: (await defaultWindowIcon()) ?? undefined,
        tooltip: t("APP_NAME"),
        menu,
        showMenuOnLeftClick: false,
        action: (event) => {
          if (event.type === "Click" && event.button === "Left" && event.buttonState === "Up") void show();
        },
      });
      this.#trayActive = true;
    } catch {
      return;
    }
  }
}

export const desktop = new Desktop();
