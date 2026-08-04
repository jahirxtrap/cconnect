const SESSION_COLORS: Record<string, string> = {
  red: "#e5484d",
  orange: "#f76b15",
  yellow: "#ffc53d",
  green: "#30a46c",
  cyan: "#00a2c7",
  blue: "#3e63dd",
  purple: "#8e4ec6",
  pink: "#e93d82",
};

export const sessionColorOf = (name: string | null | undefined): string | null =>
  (name && SESSION_COLORS[name]) ?? null;
