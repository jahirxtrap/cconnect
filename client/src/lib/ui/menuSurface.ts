import { isTouch } from "$lib/platform";
import { CARD_SCROLL_CLASS } from "./scrollbar";

export interface MenuPoint {
  x: number;
  y: number;
}

export const menuPointOf = (event: MouseEvent): MenuPoint | null =>
  isTouch ? null : { x: event.clientX, y: event.clientY };

export type SharedMenuHandler = (url: string, filename: string, at: MenuPoint | null) => void;

export const MENU_PADDING = 4;

const FLOAT = "bg-float shadow-float";

export const FLOAT_SURFACE_CLASS = `rounded-lg ${FLOAT}`;

export const FLOAT_PANEL_WIDTH = "w-(--float-panel-width) max-w-full";

export const FLOAT_HEAD_CLASS = "flex items-center py-1 pr-2 pl-3.5";

export const TOOLTIP_CLASS = `rounded-md px-2 py-1 text-body-sm ${FLOAT}`;

const MENU_SURFACE = `menu-surface z-70 ${FLOAT_SURFACE_CLASS}`;

const MENU_BOUNDS = "max-h-96 min-w-52 max-w-[min(20rem,var(--bits-floating-available-width,100vw))]";

export const MENU_LIST_CLASS = `${MENU_SURFACE} flex flex-col`;

export const MENU_SCROLL_CLASS = `${CARD_SCROLL_CLASS} scrollbar-thin`;

export const MENU_CONTENT_CLASS = `${MENU_LIST_CLASS} ${MENU_BOUNDS}`;

export const MENU_HEAD_CLASS = "shrink-0 px-1 pt-1";

export const MENU_FOOT_CLASS = "shrink-0 px-1 pb-1";

export const SUBMENU_CONTENT_CLASS = `${MENU_LIST_CLASS} max-h-96 min-w-48 max-w-[min(20rem,calc(100vw-2rem))]`;

export const MENU_ITEM_CLASS =
  "flex min-h-8 w-full cursor-pointer items-center gap-2 rounded-md px-2.5 py-1.5 text-left transition-colors outline-none select-none";

export const MENU_VALUE_CLASS = "shrink-0 pl-4 text-caption text-faint";

export const MENU_DIVIDER_CLASS = "my-1 border-t border-outline-variant";

export const MENU_ICON_SIZE = 16;

export const menuIconClass = (danger = false) => `shrink-0 ${danger ? "" : "text-on-surface-variant"}`;

export const DIALOG_OVERLAY_CLASS = "dialog-overlay fixed inset-0 z-60 bg-black/55";

export const DIALOG_SURFACE_CLASS = "menu-surface rounded-xl bg-surface shadow-float [--c-card:var(--c-hover)]";
