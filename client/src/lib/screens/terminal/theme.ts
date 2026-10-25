import type { ITheme } from "@xterm/xterm";

export const FONT_SIZE = 13;
export const LINE_HEIGHT = 1;

const LIGHT_LUMINANCE = 0.5;
const LIGHT_CONTRAST = 4.5;
const NO_CONTRAST = 1;
const CHANNEL_MAX = 255;
const LUMINANCE_WEIGHTS = [0.2126, 0.7152, 0.0722];

const token = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

const ansi = (name: string) => token(`--c-terminal-${name}`);

const luminance = (hex: string): number => {
  const value = Number.parseInt(hex.replace("#", "").slice(0, 6), 16);
  const channels = [value >> 16, value >> 8, value].map((channel) => (channel & CHANNEL_MAX) / CHANNEL_MAX);
  return channels.reduce((sum, channel, index) => sum + channel * LUMINANCE_WEIGHTS[index], 0);
};

export const terminalContrast = (): number =>
  luminance(ansi("background")) > LIGHT_LUMINANCE ? LIGHT_CONTRAST : NO_CONTRAST;

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
