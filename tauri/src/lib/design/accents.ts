export const ACCENTS: ReadonlyArray<{ name: string; value: string }> = [
  { name: "Red", value: "#f44336" },
  { name: "Pink", value: "#e91e63" },
  { name: "Purple", value: "#9c27b0" },
  { name: "Deep Purple", value: "#673ab7" },
  { name: "Indigo", value: "#3f51b5" },
  { name: "Blue", value: "#2196f3" },
  { name: "Light Blue", value: "#03a9f4" },
  { name: "Cyan", value: "#00bcd4" },
  { name: "Teal", value: "#009688" },
  { name: "Green", value: "#4caf50" },
  { name: "Light Green", value: "#8bc34a" },
  { name: "Lime", value: "#cddc39" },
  { name: "Yellow", value: "#ffeb3b" },
  { name: "Amber", value: "#ffc107" },
  { name: "Orange", value: "#ff9800" },
  { name: "Deep Orange", value: "#ff5722" },
  { name: "Brown", value: "#795548" },
  { name: "Grey", value: "#9e9e9e" },
  { name: "Blue Grey", value: "#607d8b" },
];

export const DEFAULT_ACCENT_INDEX = 4;

export const DYNAMIC_ACCENT = -1;

export const accentAt = (index: number): string =>
  (ACCENTS[index] ?? ACCENTS[DEFAULT_ACCENT_INDEX]).value;

export const accentNameAt = (index: number): string | undefined => ACCENTS[index]?.name;
