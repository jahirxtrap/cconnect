import { isTauri, systemName } from "./index";

type InstallEvent = Event & { prompt: () => Promise<void> };

const standalone = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

class WebApp {
  prompt = $state<InstallEvent | null>(null);
  installed = $state(isTauri || standalone());

  readonly manual = !isTauri && systemName() === "ios";

  readonly offered = $derived(!this.installed && (this.prompt !== null || this.manual));

  listen() {
    if (isTauri) return;
    window.addEventListener("beforeinstallprompt", (event) => {
      event.preventDefault();
      this.prompt = event as InstallEvent;
    });
    window.addEventListener("appinstalled", () => {
      this.prompt = null;
      this.installed = true;
    });
  }

  async install(): Promise<boolean> {
    const event = this.prompt;
    if (!event) return false;
    this.prompt = null;
    await event.prompt();
    return true;
  }
}

export const webApp = new WebApp();

export const registerServiceWorker = () => {
  if (isTauri || location.protocol !== "https:" || !("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => void navigator.serviceWorker.register("/sw.js"));
};
