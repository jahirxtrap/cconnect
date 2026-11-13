import { isTauri, isTouch } from "./index";

interface NativeVideo extends HTMLVideoElement {
  webkitEnterFullscreen?: () => void;
}

class Fullscreen {
  element = $state<Element | null>(null);
  #turned = false;

  readonly portalTarget = $derived<HTMLElement | string>(
    this.element instanceof HTMLElement && this.element !== document.documentElement ? this.element : "body",
  );

  constructor() {
    if (typeof document === "undefined") return;
    this.element = document.fullscreenElement;
    document.addEventListener("fullscreenchange", () => {
      this.element = document.fullscreenElement;
      if (this.element || !this.#turned) return;
      this.#turned = false;
      screen.orientation.unlock?.();
    });
  }

  #turn() {
    if (isTauri || !isTouch) return;
    void screen.orientation.lock?.("landscape").then(
      () => (this.#turned = true),
      () => {},
    );
  }

  supported(video: HTMLVideoElement | null = null): boolean {
    return document.fullscreenEnabled || typeof (video as NativeVideo | null)?.webkitEnterFullscreen === "function";
  }

  holds(target: Element | null): boolean {
    return target !== null && this.element === target;
  }

  async toggle(target: HTMLElement, video: HTMLVideoElement | null = null) {
    if (this.holds(target)) {
      await document.exitFullscreen();
      return;
    }
    if (document.fullscreenEnabled) {
      await target.requestFullscreen();
      this.#turn();
      return;
    }
    (video as NativeVideo | null)?.webkitEnterFullscreen?.();
  }
}

export const fullscreen = new Fullscreen();
