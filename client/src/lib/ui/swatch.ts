export const SWATCH_GRID_CLASS = "grid grid-cols-[repeat(5,2.5rem)] justify-between gap-y-3";

const SWATCH_BASE = "flex shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors";

export const SWATCH_CLASS = `${SWATCH_BASE} size-10`;

export const SWATCH_SMALL_CLASS = `${SWATCH_BASE} size-7`;

export const swatchState = (selected: boolean) =>
  selected ? "border-2 border-accent" : "border border-outline-variant hover:border-outline";
