import type { ITheme } from "@xterm/xterm";

export const TERMINAL_BACKGROUND = "#000000";
export const TERMINAL_FOREGROUND = "#ffffff";

export const FONT_SIZE = 13;
export const LINE_HEIGHT = 1;

const token = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

export const terminalTheme = (): ITheme => ({
  background: TERMINAL_BACKGROUND,
  foreground: TERMINAL_FOREGROUND,
  cursor: TERMINAL_FOREGROUND,
  cursorAccent: TERMINAL_BACKGROUND,
  selectionBackground: token("--c-accent-selection"),
  black: "#000000",
  red: "#cd3131",
  green: "#0dbc79",
  yellow: "#e5e510",
  blue: "#2472c8",
  magenta: "#bc3fbc",
  cyan: "#11a8cd",
  white: "#e5e5e5",
  brightBlack: "#666666",
  brightRed: "#f14c4c",
  brightGreen: "#23d18b",
  brightYellow: "#f5f543",
  brightBlue: "#3b8eea",
  brightMagenta: "#d670d6",
  brightCyan: "#29b8db",
  brightWhite: "#ffffff",
});
