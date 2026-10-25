export const DYNAMIC_ACCENT = "dynamic";

export const THEME_ACCENT = "theme";

export const DEFAULT_ACCENT = THEME_ACCENT;

const channelsOf = (hex: string): [number, number, number] | null => {
  const value = hex.replace("#", "");
  const full = value.length <= 4 ? value.replace(/./g, (c) => c + c) : value;
  const channels = Number.parseInt(full.slice(0, 6), 16);
  if (full.length < 6 || Number.isNaN(channels)) return null;
  return [(channels >> 16) & 255, (channels >> 8) & 255, channels & 255];
};

export const rgbOf = (hex: string): string => (channelsOf(hex) ?? [0, 0, 0]).join(", ");

export const withAlpha = (hex: string, alpha: number): string => {
  const channels = channelsOf(hex);
  return channels ? `rgba(${channels.join(", ")}, ${alpha})` : hex;
};
