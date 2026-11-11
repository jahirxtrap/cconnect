export const FIELD_LABEL_CLASS = "mb-(--chat-gap-sm) text-label-lg";

export const FIELD_INPUT_CLASS =
  "min-w-0 flex-1 bg-transparent text-body-md caret-accent outline-none placeholder:text-faint";

export const FIELD_ACTIONS_CLASS = "absolute inset-y-0 right-1 flex items-center";

export const FIELD_ACTIONS_GAP = 4;

export const REPAINT_EDGE_CLASS = "outline outline-transparent";

export const FIELD_RING_CLASS = `ring-(length:--hairline) transition-shadow ring-inset ${REPAINT_EDGE_CLASS}`;

export const FIELD_BOX_CLASS = `relative flex w-full items-center rounded-md bg-surface-variant px-3 py-2 ${FIELD_RING_CLASS}`;

export const FIELD_ROW_CLASS = "flex items-end gap-2";

export const FIELD_WIDE_CLASS = "min-w-0 flex-1";

export const FIELD_PORT_CLASS = "w-40 shrink-0";

export const selectField = (field: HTMLInputElement | HTMLTextAreaElement) => {
  field.focus();
  field.select();
};
