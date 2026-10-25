export const MENU_PADDING = 4;

const FLOAT = "bg-float shadow-float";

export const FLOAT_SURFACE_CLASS = `rounded-lg ${FLOAT}`;

export const FLOAT_PANEL_WIDTH = "w-full sm:w-90";

export const TOOLTIP_CLASS = `rounded-md px-2 py-1 text-body-sm ${FLOAT}`;

const MENU_SURFACE = `menu-surface z-70 ${FLOAT_SURFACE_CLASS}`;

const MENU_SCROLL = "scrollbar-thin overflow-x-hidden overflow-y-auto";

const MENU_BOUNDS = "max-h-96 min-w-52 max-w-[var(--bits-floating-available-width,100vw)]";

export const MENU_LIST_CLASS = `${MENU_SURFACE} p-1 ${MENU_SCROLL}`;

export const MENU_CONTENT_CLASS = `${MENU_LIST_CLASS} ${MENU_BOUNDS}`;

export const MENU_PANEL_CLASS = `${MENU_SURFACE} flex flex-col ${MENU_BOUNDS}`;

export const MENU_PANEL_HEAD_CLASS = "shrink-0 px-1 pt-1";

export const MENU_PANEL_BODY_CLASS = `min-h-0 flex-1 px-1 pb-1 ${MENU_SCROLL}`;

export const SUBMENU_CONTENT_CLASS = `${MENU_LIST_CLASS} max-h-96 min-w-48 max-w-[calc(100vw-2rem)]`;

export const MENU_ITEM_CLASS =
  "flex min-h-8 w-full cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left transition-colors outline-none select-none";

export const MENU_ICON_SIZE = 16;

export const menuIconClass = (danger = false) => `shrink-0 ${danger ? "" : "text-on-surface-variant"}`;

export const DIALOG_OVERLAY_CLASS = "fixed inset-0 z-60 bg-black/55";

export const DIALOG_SURFACE_CLASS = "menu-surface rounded-xl bg-surface shadow-float [--c-card:var(--c-hover)]";
