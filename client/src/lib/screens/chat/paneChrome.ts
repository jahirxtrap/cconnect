export const PANE_BODY_CLASS = "flex h-full flex-col";

export const PANE_TOP_CLASS = "flex h-12 shrink-0 items-center gap-1 px-2";

export const PANE_HEADER_CLASS = `${PANE_TOP_CLASS} cursor-pointer transition-opacity`;

export const PANE_SUB_CLASS = "flex h-10 shrink-0 items-center gap-1 px-2";

export const paneDim = (dimmed: boolean) => (dimmed ? "opacity-50" : "");

export const paneTabClass = (active: boolean, focused: boolean) =>
  active ? (focused ? "bg-surface-variant text-on-surface" : "bg-hover text-on-surface") : "text-on-surface-variant hover:bg-hover";
