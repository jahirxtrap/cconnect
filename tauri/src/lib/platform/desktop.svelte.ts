import { navigation } from "$lib/app/navigation.svelte";
import { settings } from "$lib/data/settings.svelte";
import { t } from "$lib/i18n/index.svelte";
import { localServer } from "$lib/services/localServer.svelte";
import { isTauri } from "./index";
import type { Window } from "@tauri-apps/api/window";

const TRAY_ID = "cconnect";
const SCREEN_WIDTH_FRACTION = 0.8;
const SCREEN_HEIGHT_FRACTION = 0.85;
const BOUNDS_SAVE_MS = 400;

interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

const parseBounds = (raw: string): Bounds | null => {
  try {
    const value = JSON.parse(raw || "null") as Partial<Bounds> | null;
    if (!value) return null;
    const { x, y, width, height } = value;
    const valid = [x, y, width, height].every((item) => typeof item === "number" && Number.isFinite(item));
    return valid && width! > 0 && height! > 0 ? { x: x!, y: y!, width: width!, height: height! } : null;
  } catch {
    return null;
  }
};

class Desktop {
  refreshTick = $state(0);

  #trayActive = false;
  #boundsTimer: ReturnType<typeof setTimeout> | null = null;

  async toggleFullscreen() {
    if (!isTauri) {
      const root = document.documentElement;
      if (document.fullscreenElement) await document.exitFullscreen();
      else await root.requestFullscreen();
      return;
    }
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    const current = getCurrentWindow();
    await current.setFullscreen(!(await current.isFullscreen()));
  }

  async start() {
    if (!isTauri) return;
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    try {
      await this.#window();
    } finally {
      await getCurrentWindow().show();
    }
    await this.#tray();
    if (settings.localServerEnabled && settings.localServerDir) localServer.start();
  }

  async #window() {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    const current = getCurrentWindow();

    await this.#restoreBounds(current);

    void current.onCloseRequested(async (event) => {
      if (!settings.minimizeToTray || !this.#trayActive) return;
      event.preventDefault();
      await current.hide();
    });

    void current.onResized(async () => {
      settings.windowMaximized = await current.isMaximized();
      this.#saveBoundsSoon(current);
    });

    void current.onMoved(() => this.#saveBoundsSoon(current));

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

  async #restoreBounds(current: Window) {
    try {
      const { LogicalPosition, LogicalSize, availableMonitors, currentMonitor } = await import(
        "@tauri-apps/api/window"
      );
      const saved = parseBounds(settings.windowBounds);
      const monitors = await availableMonitors();
      const visible =
        saved !== null &&
        monitors.some((monitor) => {
          const left = monitor.position.x / monitor.scaleFactor;
          const top = monitor.position.y / monitor.scaleFactor;
          return (
            saved.x + saved.width / 2 >= left &&
            saved.x + saved.width / 2 < left + monitor.size.width / monitor.scaleFactor &&
            saved.y + saved.height / 2 >= top &&
            saved.y + saved.height / 2 < top + monitor.size.height / monitor.scaleFactor
          );
        });

      if (saved && visible) {
        await current.setSize(new LogicalSize(saved.width, saved.height));
        await current.setPosition(new LogicalPosition(saved.x, saved.y));
      } else {
        const monitor = await currentMonitor();
        if (monitor) {
          await current.setSize(
            new LogicalSize(
              Math.round((monitor.size.width / monitor.scaleFactor) * SCREEN_WIDTH_FRACTION),
              Math.round((monitor.size.height / monitor.scaleFactor) * SCREEN_HEIGHT_FRACTION),
            ),
          );
        }
        await current.center();
      }

      if (settings.windowMaximized) await current.maximize();
    } finally {
      await current.show();
    }
  }

  #saveBoundsSoon(current: Window) {
    if (this.#boundsTimer !== null) clearTimeout(this.#boundsTimer);
    this.#boundsTimer = setTimeout(() => void this.#saveBounds(current), BOUNDS_SAVE_MS);
  }

  async #saveBounds(current: Window) {
    if ((await current.isMaximized()) || (await current.isFullscreen()) || (await current.isMinimized())) return;
    const scale = await current.scaleFactor();
    const size = (await current.innerSize()).toLogical(scale);
    const position = (await current.outerPosition()).toLogical(scale);
    settings.windowBounds = JSON.stringify({
      x: Math.round(position.x),
      y: Math.round(position.y),
      width: Math.round(size.width),
      height: Math.round(size.height),
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
