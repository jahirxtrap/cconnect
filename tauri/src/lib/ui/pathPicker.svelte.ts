import { isTauri } from "$lib/platform";

export const pickPath = async (mode: "dir" | "file"): Promise<string | "fallback" | null> => {
  if (!isTauri) return "fallback";
  const { open } = await import("@tauri-apps/plugin-dialog");
  const selected = await open({ directory: mode === "dir", multiple: false });
  return typeof selected === "string" ? selected : null;
};
