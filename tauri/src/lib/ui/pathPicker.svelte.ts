import { isTauri } from "$lib/platform";

/**
 * One way in for every path field. The desktop build opens the OS dialog; web and Android walk
 * the PC's folders through the backend instead (a browser cannot hand out a real path), and
 * that fallback is what `PathPickerDialog` renders when this returns "fallback".
 */
export const pickPath = async (mode: "dir" | "file"): Promise<string | "fallback" | null> => {
  if (!isTauri) return "fallback";
  const { open } = await import("@tauri-apps/plugin-dialog");
  const selected = await open({ directory: mode === "dir", multiple: false });
  return typeof selected === "string" ? selected : null;
};
