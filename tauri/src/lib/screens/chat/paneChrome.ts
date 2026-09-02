export const PANE_BODY_CLASS = "flex h-full flex-col border-l border-outline-variant";

export const PANE_HEADER_CLASS =
  "flex h-12 shrink-0 cursor-pointer items-center border-b bg-surface transition-colors duration-200";

export const paneFocusBorder = (focused: boolean) => (focused ? "border-accent" : "border-outline-variant");

export const paneAction = (compact: boolean) => ({
  class: compact ? "size-8" : "",
  size: compact ? 18 : 20,
});
