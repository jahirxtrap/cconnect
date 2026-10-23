import { isTouch } from "$lib/platform";

const hold = (event: Event) => {
  const active = document.activeElement;
  if (active instanceof HTMLElement && active !== event.currentTarget) event.preventDefault();
};

const typing = (node: EventTarget | null): node is HTMLElement =>
  node instanceof HTMLElement &&
  (node.isContentEditable || node.tagName === "INPUT" || node.tagName === "TEXTAREA");

export const returnFocus = (event: FocusEvent) => {
  const previous = event.relatedTarget;
  if (!isTouch || !typing(previous)) return;
  previous.focus({ preventScroll: true });
};

export const typingOnTouch = () => isTouch && typing(document.activeElement);

export const keepTyping = (event: Event) => {
  if (typingOnTouch() && !typing(event.target)) event.preventDefault();
};

export const holdFocus = hold;

export const restoreFocus = hold;

export const keepFocus = (node: HTMLElement) => {
  node.addEventListener("mousedown", hold);
  node.addEventListener("pointerdown", hold);
  return {
    destroy() {
      node.removeEventListener("mousedown", hold);
      node.removeEventListener("pointerdown", hold);
    },
  };
};
