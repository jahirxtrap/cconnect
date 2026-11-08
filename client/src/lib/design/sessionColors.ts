import { t } from "$lib/i18n/index.svelte";

const SESSION_COLORS: Record<string, { color: string; label: string }> = {
  red: { color: "#e5484d", label: "COLOR_RED" },
  orange: { color: "#f76b15", label: "COLOR_ORANGE" },
  yellow: { color: "#ffc53d", label: "COLOR_YELLOW" },
  green: { color: "#30a46c", label: "COLOR_GREEN" },
  cyan: { color: "#00a2c7", label: "COLOR_CYAN" },
  blue: { color: "#3e63dd", label: "COLOR_BLUE" },
  purple: { color: "#8e4ec6", label: "COLOR_PURPLE" },
  pink: { color: "#e93d82", label: "COLOR_PINK" },
};

export const sessionColorOf = (name: string | null | undefined): string | null =>
  (name && SESSION_COLORS[name]?.color) ?? null;

export const sessionColorLabel = (name: string): string => {
  const known = SESSION_COLORS[name];
  return known ? t(known.label) : name;
};

export const sessionColorOptions = (names: string[]) =>
  names.flatMap((name) => {
    const known = SESSION_COLORS[name];
    return known ? [{ value: name, color: known.color, label: sessionColorLabel(name) }] : [];
  });
