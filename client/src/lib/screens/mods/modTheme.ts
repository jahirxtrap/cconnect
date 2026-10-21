const CLAUDE = "rgb(215,119,87)";

const THEME: Record<string, string> = {
  text: "var(--color-on-surface)",
  inverseText: "var(--color-surface)",
  inactive: "var(--color-on-surface-variant)",
  subtle: "var(--color-outline)",
  suggestion: "var(--color-blue)",
  remember: "var(--color-blue)",
  permission: "var(--color-blue)",
  ide: "var(--color-blue)",
  professionalBlue: "var(--color-blue)",
  rate_limit_fill: "var(--color-blue)",
  briefLabelYou: "var(--color-blue)",
  success: "var(--color-green)",
  error: "var(--color-red)",
  warning: "var(--color-yellow)",
  chromeYellow: "var(--color-yellow)",
  merged: "var(--color-purple)",
  autoAccept: "var(--color-purple)",
  skill: "var(--color-purple)",
  effortUltra: "var(--color-purple)",
  bashBorder: "var(--color-purple)",
  claude: CLAUDE,
  briefLabelClaude: CLAUDE,
  fastMode: "var(--color-orange)",
  planMode: "var(--color-cyan)",
  background: "var(--color-cyan)",
  promptBorder: "var(--color-outline)",
  rate_limit_empty: "var(--color-outline)",
  userMessageBackground: "var(--color-surface-variant)",
  selectionBg: "var(--c-accent-selection)",
  diffAdded: "var(--color-green-bg)",
  diffRemoved: "var(--color-red-bg)",
  diffAddedDimmed: "var(--color-green-bg)",
  diffRemovedDimmed: "var(--color-red-bg)",
  diffAddedWord: "var(--color-green)",
  diffRemovedWord: "var(--color-red)",
  rainbow_red: "rgb(235,95,87)",
  rainbow_orange: "rgb(245,139,87)",
  rainbow_yellow: "rgb(250,195,95)",
  rainbow_green: "rgb(145,200,130)",
  rainbow_blue: "rgb(130,170,220)",
  rainbow_indigo: "rgb(155,130,200)",
  rainbow_violet: "rgb(200,130,180)",
};

const NAMED: Record<string, string> = {
  black: "#000000",
  red: "var(--color-red)",
  green: "var(--color-green)",
  yellow: "var(--color-yellow)",
  blue: "var(--color-blue)",
  magenta: "var(--color-purple)",
  cyan: "var(--color-cyan)",
  white: "var(--color-on-surface)",
  gray: "var(--color-gray)",
  grey: "var(--color-gray)",
};

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
const RGB = /^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i;
const ANSI256 = /^ansi256\(\s*(\d{1,3})\s*\)$/i;
const BRIGHT = /Bright$/;
const ORDER = ["black", "red", "green", "yellow", "blue", "magenta", "cyan", "white"];
const CUBE = [0, 95, 135, 175, 215, 255];

const indexed = (index: number): string | null => {
  if (index < 0 || index > 255) return null;
  if (index < 16) return NAMED[ORDER[index % 8]];
  if (index >= 232) {
    const level = 8 + (index - 232) * 10;
    return `rgb(${level},${level},${level})`;
  }
  const cube = index - 16;
  return `rgb(${CUBE[Math.floor(cube / 36)]},${CUBE[Math.floor(cube / 6) % 6]},${CUBE[cube % 6]})`;
};

export const DIM = THEME.inactive;

export const modColor = (value: unknown): string | null => {
  if (typeof value !== "string" || !value) return null;
  if (Object.hasOwn(THEME, value)) return THEME[value];
  const name = (value.startsWith("ansi:") ? value.slice(5) : value).replace(BRIGHT, "");
  if (Object.hasOwn(NAMED, name)) return NAMED[name];
  if (HEX.test(value)) return value;
  const rgb = RGB.exec(value);
  if (rgb) return rgb.slice(1).every((part) => Number(part) <= 255) ? value : null;
  const ansi = ANSI256.exec(value);
  return ansi ? indexed(Number(ansi[1])) : null;
};
