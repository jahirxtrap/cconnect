import type { ShortcutScope } from "$lib/platform/shortcuts.svelte";

export type Pane = Exclude<ShortcutScope, "global">;

class PaneFocus {
  active = $state<Pane>("chat");

  #targets: Partial<Record<Pane, () => void>> = {};

  set(pane: Pane) {
    this.active = pane;
  }

  register(pane: Pane, focus: () => void) {
    this.#targets[pane] = focus;
    return () => {
      if (this.#targets[pane] === focus) delete this.#targets[pane];
    };
  }

  focusActive() {
    this.#targets[this.active]?.();
  }
}

export const paneFocus = new PaneFocus();

export const isEditing = () => {
  const node = document.activeElement;
  if (!(node instanceof HTMLElement)) return false;
  return node.isContentEditable || node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement;
};
