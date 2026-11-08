import { MILLIS_PER_SECOND } from "$lib/data/time";

const UNDO_SECONDS = 6;

interface UndoOffer {
  id: number;
  text: string;
  undo: () => unknown;
}

class UndoNotice {
  current = $state<UndoOffer | null>(null);
  #timer: ReturnType<typeof setTimeout> | null = null;
  #next = 0;

  offer(text: string, undo: () => unknown) {
    this.#stop();
    this.current = { id: ++this.#next, text, undo };
    this.#timer = setTimeout(() => this.dismiss(), UNDO_SECONDS * MILLIS_PER_SECOND);
  }

  undo() {
    const offer = this.current;
    this.dismiss();
    offer?.undo();
  }

  dismiss() {
    this.#stop();
    this.current = null;
  }

  #stop() {
    if (this.#timer !== null) clearTimeout(this.#timer);
    this.#timer = null;
  }
}

export const undoNotice = new UndoNotice();
