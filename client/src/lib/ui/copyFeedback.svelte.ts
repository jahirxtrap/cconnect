import { copyText } from "$lib/platform/clipboard";

const COPIED_MS = 1000;

export class CopyFeedback {
  copied = $state(false);
  #timer: ReturnType<typeof setTimeout> | undefined;

  mark() {
    this.copied = true;
    clearTimeout(this.#timer);
    this.#timer = setTimeout(() => (this.copied = false), COPIED_MS);
  }

  copy(text: string) {
    void copyText(text);
    this.mark();
  }
}
