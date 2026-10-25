export const SWATCH_GRID_CLASS = "grid grid-cols-[repeat(5,2.5rem)] justify-between gap-y-3";

export const SWATCH_CLASS =
  "flex size-10 cursor-pointer items-center justify-center rounded-full transition-shadow hover:shadow-[inset_0_0_0_1px_white]";

export const swatchBorder = (selected: boolean) =>
  `border ${selected ? "border-on-surface" : "border-outline-variant"}`;
