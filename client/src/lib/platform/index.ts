export const isTauri = "__TAURI_INTERNALS__" in window;

export const isTouch = window.matchMedia("(pointer: coarse)").matches;

export type SystemName = "windows" | "macos" | "linux" | "android" | "ios";

const detectSystem = (): SystemName => {
  const agent = navigator.userAgent;
  if (/Android/i.test(agent)) return "android";
  if (/iPhone|iPad|iPod/i.test(agent)) return "ios";
  if (/Mac/i.test(agent)) return navigator.maxTouchPoints > 1 ? "ios" : "macos";
  if (/Win/i.test(agent)) return "windows";
  return "linux";
};

const SYSTEM = detectSystem();

export const systemName = (): SystemName => SYSTEM;

export const platformName = (): SystemName | "web" => (isTauri ? SYSTEM : "web");

export const openExternal = (url: string) => {
  const fallback = () => void window.open(url, "_blank", "noopener");
  if (!isTauri) {
    fallback();
    return;
  }
  void import("@tauri-apps/plugin-opener").then(({ openUrl }) => openUrl(url).catch(fallback), fallback);
};

export const isMobile = platformName() === "android" || platformName() === "ios";

export const isDesktop = isTauri && !isMobile;
