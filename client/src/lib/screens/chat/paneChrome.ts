export const PANE_BODY_CLASS = "flex h-full flex-col";

export const COMPACT_INSET_CLASS = "[--page-inset:var(--page-inset-compact)]";

export const CHAT_COLUMN_CLASS = "mx-auto w-full max-w-(--chat-column)";

export const FULL_INSET_CLASS = "[--page-inset:var(--page-inset-full)]";

export const FULL_VIEW_CLASS = `safe-area above-keyboard fixed inset-0 z-50 flex flex-col bg-background text-on-surface ${FULL_INSET_CLASS}`;

export const PANE_CARD_SHAPE_CLASS = "overflow-hidden rounded-panel";

export const PANE_CARD_CLASS = `${PANE_CARD_SHAPE_CLASS} bg-background`;

export const PANE_GLASS_CLASS = `${PANE_CARD_SHAPE_CLASS} glass-panel`;

export const paneCardClass = (glass: boolean, chat = false) =>
  glass ? (chat ? PANE_CARD_SHAPE_CLASS : PANE_GLASS_CLASS) : PANE_CARD_CLASS;

export const PANE_TOP_CLASS = "flex h-12 shrink-0 items-center gap-1 px-2";

export const PANE_HEADER_CLASS = `${PANE_TOP_CLASS} cursor-pointer transition-opacity`;

export const PANE_SUB_CLASS = "flex h-10 shrink-0 items-center gap-1 px-2";

export const paneDim = (dimmed: boolean) => (dimmed ? "opacity-40" : "");

export const paneTabClass = (active: boolean, focused: boolean) =>
  active
    ? `${focused ? "bg-surface-variant" : "bg-hover"} text-on-surface`
    : "text-on-surface-variant hover:bg-hover";
