import { isTauri, isTouch } from "./index";

interface NativeVideo extends HTMLVideoElement {
  webkitEnterFullscreen?: () => void;
}

const androidFullscreen = () =>
  (window as unknown as { AndroidFullscreen?: { shape: (upright: boolean) => void } }).AndroidFullscreen;

const isUpright = (video: HTMLVideoElement | null): boolean => video !== null && video.videoHeight > video.videoWidth;

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

  #turn(upright: boolean) {
    if (isTauri || !isTouch || upright) return;
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
      const upright = isUpright(video);
      androidFullscreen()?.shape(upright);
      await target.requestFullscreen();
      this.#turn(upright);
      return;
    }
    (video as NativeVideo | null)?.webkitEnterFullscreen?.();
  }
}

export const fullscreen = new Fullscreen();
