const hold = (event: Event) => {
  const active = document.activeElement;
  if (active instanceof HTMLElement && active !== event.currentTarget) event.preventDefault();
};

export const holdFocus = hold;

export const restoreFocus = hold;

export const keepFocus = (node: HTMLElement) => {
  node.addEventListener("mousedown", hold);
  return {
    destroy() {
      node.removeEventListener("mousedown", hold);
    },
  };
};
