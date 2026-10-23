export const MENU_PADDING = 4;

const BASE =
  "menu-surface scrollbar-thin z-70 max-h-96 overflow-x-hidden overflow-y-auto rounded-md border-2 border-outline-variant bg-surface-variant p-1 shadow-lg";

export const MENU_CONTENT_CLASS = `${BASE} min-w-40 max-w-[var(--bits-floating-available-width,100vw)]`;

export const SUBMENU_CONTENT_CLASS = `${BASE} min-w-48 max-w-[calc(100vw-2rem)]`;
