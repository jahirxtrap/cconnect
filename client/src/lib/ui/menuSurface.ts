export const MENU_PADDING = 4;

const FLOAT = "bg-float shadow-float";

export const FLOAT_SURFACE_CLASS = `rounded-lg ${FLOAT}`;

export const FLOAT_PANEL_WIDTH = "w-full sm:w-90";

export const TOOLTIP_CLASS = `rounded-md px-2 py-1 text-body-sm ${FLOAT}`;

export const MENU_LIST_CLASS = `menu-surface scrollbar-thin z-70 overflow-x-hidden overflow-y-auto p-1 ${FLOAT_SURFACE_CLASS}`;

export const MENU_CONTENT_CLASS = `${MENU_LIST_CLASS} max-h-96 min-w-52 max-w-[var(--bits-floating-available-width,100vw)]`;

export const SUBMENU_CONTENT_CLASS = `${MENU_LIST_CLASS} max-h-96 min-w-48 max-w-[calc(100vw-2rem)]`;

export const MENU_ITEM_CLASS =
  "flex min-h-8 w-full cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left transition-colors outline-none select-none";

export const MENU_ICON_SIZE = 16;

export const menuIconClass = (danger = false) => `shrink-0 ${danger ? "" : "text-on-surface-variant"}`;

export const DIALOG_OVERLAY_CLASS = "fixed inset-0 z-60 bg-black/55";

export const DIALOG_SURFACE_CLASS = "menu-surface rounded-xl bg-surface shadow-float [--c-card:var(--c-hover)]";
