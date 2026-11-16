const CLAUDE = "rgb(215,119,87)";

const THEME: Record<string, string> = {
  text: "var(--c-on-background)",
  inverseText: "var(--c-surface)",
  inactive: "var(--c-on-surface-variant)",
  subtle: "var(--c-outline)",
  suggestion: "var(--c-blue)",
  remember: "var(--c-blue)",
  permission: "var(--c-blue)",
  ide: "var(--c-blue)",
  professionalBlue: "var(--c-blue)",
  rate_limit_fill: "var(--c-blue)",
  briefLabelYou: "var(--c-blue)",
  success: "var(--c-green)",
  error: "var(--c-red)",
  warning: "var(--c-yellow)",
  chromeYellow: "var(--c-yellow)",
  merged: "var(--c-purple)",
  autoAccept: "var(--c-purple)",
  skill: "var(--c-purple)",
  effortUltra: "var(--c-purple)",
  bashBorder: "var(--c-purple)",
  claude: CLAUDE,
  briefLabelClaude: CLAUDE,
  fastMode: "var(--c-orange)",
  planMode: "var(--c-cyan)",
  background: "var(--c-cyan)",
  promptBorder: "var(--c-outline)",
  rate_limit_empty: "var(--c-outline)",
  userMessageBackground: "var(--c-surface-variant)",
  selectionBg: "var(--c-accent-selection)",
  diffAdded: "var(--c-green-bg)",
  diffRemoved: "var(--c-red-bg)",
  diffAddedDimmed: "var(--c-green-bg)",
  diffRemovedDimmed: "var(--c-red-bg)",
  diffAddedWord: "var(--c-green)",
  diffRemovedWord: "var(--c-red)",
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
  red: "var(--c-red)",
  green: "var(--c-green)",
  yellow: "var(--c-yellow)",
  blue: "var(--c-blue)",
  magenta: "var(--c-purple)",
  cyan: "var(--c-cyan)",
  white: "var(--c-on-background)",
  gray: "var(--c-gray)",
  grey: "var(--c-gray)",
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
