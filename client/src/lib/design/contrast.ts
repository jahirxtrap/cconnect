import { channelsOf } from "./accents";

type Triple = readonly [number, number, number];
type Colors = Readonly<Record<string, string>>;

export const TEXT_CONTRAST = 4.5;

const FLARE = 0.05;
const CHANNEL_MAX = 255;
const LINEAR_KNEE = 0.04045;
const LINEAR_SLOPE = 12.92;
const GAMMA = 2.4;
const GAMMA_OFFSET = 0.055;
const BLACK: Triple = [0, 0, 0];
const LUMINANCE_WEIGHTS: Triple = [0.2126, 0.7152, 0.0722];
const MID_LUMINANCE = Math.sqrt(FLARE * (1 + FLARE)) - FLARE;

const TEXT_ENDS = ["on-background", "background"] as const;
const EXTREMES = ["#000000", "#ffffff"] as const;
const FILL_TEXT = "on-accent";

const decode = (channel: number) => {
  const value = channel / CHANNEL_MAX;
  return value <= LINEAR_KNEE ? value / LINEAR_SLOPE : ((value + GAMMA_OFFSET) / (1 + GAMMA_OFFSET)) ** GAMMA;
};

export const luminance = (hex: string) =>
  (channelsOf(hex) ?? BLACK).reduce((sum, channel, index) => sum + decode(channel) * LUMINANCE_WEIGHTS[index], 0);

export const contrast = (front: string, back: string) => {
  const [low, high] = [luminance(front), luminance(back)].sort((a, b) => a - b);
  return (high + FLARE) / (low + FLARE);
};

export const isLight = (hex: string) => luminance(hex) > MID_LUMINANCE;

export const textOn = (fill: string, colors: Colors) => {
  const candidates = [colors[FILL_TEXT], ...TEXT_ENDS.map((name) => colors[name]), ...EXTREMES];
  return (
    candidates.find((candidate) => contrast(candidate, fill) >= TEXT_CONTRAST) ??
    candidates.reduce((best, candidate) => (contrast(candidate, fill) > contrast(best, fill) ? candidate : best))
  );
};
