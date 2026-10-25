import type { BackgroundFit } from "./packs/schema";

export interface BackgroundLook {
  opacity: number;
  brightness: number;
  blur: number;
  saturation: number;
}

export interface BackgroundEffects extends BackgroundLook {
  fit: BackgroundFit;
  x: number;
  y: number;
}

export const BACKGROUND_STYLES = {
  sharp: { opacity: 100, brightness: 100, blur: 0, saturation: 100 },
  soft: { opacity: 40, brightness: 100, blur: 6, saturation: 90 },
  dark: { opacity: 100, brightness: 40, blur: 2, saturation: 80 },
} satisfies Record<string, BackgroundLook>;

export type BackgroundStyle = keyof typeof BACKGROUND_STYLES;

export const DEFAULT_EFFECTS: BackgroundEffects = { ...BACKGROUND_STYLES.dark, fit: "cover", x: 50, y: 50 };

export const UPLOAD_EFFECTS: BackgroundEffects = { ...DEFAULT_EFFECTS, ...BACKGROUND_STYLES.sharp };

export type BackgroundArt = "logo";

export const BUILTIN_BACKGROUNDS: readonly { id: BackgroundArt; effects: Partial<BackgroundEffects> }[] = [
  { id: "logo", effects: { ...BACKGROUND_STYLES.sharp, opacity: 8 } },
];

export const NO_BACKGROUND = "none";

export const DEFAULT_BACKGROUND = NO_BACKGROUND;

export const sameEffects = (a: BackgroundEffects, b: BackgroundEffects): boolean =>
  (Object.keys(DEFAULT_EFFECTS) as (keyof BackgroundEffects)[]).every((field) => a[field] === b[field]);

export const styleOf = (look: BackgroundLook): BackgroundStyle | null =>
  (Object.keys(BACKGROUND_STYLES) as BackgroundStyle[]).find((name) =>
    (Object.keys(BACKGROUND_STYLES[name]) as (keyof BackgroundLook)[]).every(
      (field) => BACKGROUND_STYLES[name][field] === look[field],
    ),
  ) ?? null;
