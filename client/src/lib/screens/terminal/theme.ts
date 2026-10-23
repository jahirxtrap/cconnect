import type { ITheme } from "@xterm/xterm";

export const FONT_SIZE = 13;
export const LINE_HEIGHT = 1;

const token = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

const ansi = (name: string) => token(`--c-terminal-${name}`);

export const terminalTheme = (): ITheme => ({
  background: ansi("background"),
  foreground: ansi("foreground"),
  cursor: ansi("foreground"),
  cursorAccent: ansi("background"),
  selectionBackground: token("--c-accent-selection"),
  black: ansi("black"),
  red: ansi("red"),
  green: ansi("green"),
  yellow: ansi("yellow"),
  blue: ansi("blue"),
  magenta: ansi("magenta"),
  cyan: ansi("cyan"),
  white: ansi("white"),
  brightBlack: ansi("bright-black"),
  brightRed: ansi("bright-red"),
  brightGreen: ansi("bright-green"),
  brightYellow: ansi("bright-yellow"),
  brightBlue: ansi("bright-blue"),
  brightMagenta: ansi("bright-magenta"),
  brightCyan: ansi("bright-cyan"),
  brightWhite: ansi("bright-white"),
});
