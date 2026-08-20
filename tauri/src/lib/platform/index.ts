export const isTauri = "__TAURI_INTERNALS__" in window;

export const isTouch = window.matchMedia("(pointer: coarse)").matches;

export const platformName = (): "windows" | "macos" | "linux" | "android" | "ios" | "web" => {
  if (!isTauri) return "web";
  const agent = navigator.userAgent;
  if (/Android/i.test(agent)) return "android";
  if (/iPhone|iPad/i.test(agent)) return "ios";
  if (/Mac/i.test(agent)) return "macos";
  if (/Win/i.test(agent)) return "windows";
  return "linux";
};

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
