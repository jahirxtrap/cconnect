const CHIP_SHAPE = "flex h-7 shrink-0 items-center rounded-full text-body-sm text-on-surface-variant";
const CHIP = `${CHIP_SHAPE} bg-surface-variant`;

export const CHIP_ITEM_CLASS = `${CHIP} ripple cursor-pointer gap-1.5 px-2.5 transition-colors hover:text-on-surface`;
export const CHIP_STATE_CLASS = `${CHIP} cursor-default gap-1.5 px-2.5`;
export const CHIP_SLOT = "flex shrink-0 items-center";
export const CHIP_ICON_SIZE = 16;

export const chipToggleClass = (on: boolean) =>
  `${CHIP_SHAPE} ${on ? "bg-accent-soft" : "bg-surface-variant"} ripple w-7 cursor-pointer justify-center transition-colors hover:text-on-surface`;
