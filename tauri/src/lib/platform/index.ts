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
