import { store } from "$lib/platform/storage";

const SCRATCH_KEY = "markdown.scratch";
const SAVE_DELAY_MS = 400;

class Scratch {
  text = $state(store.get(SCRATCH_KEY, ""));
  formatted = $state(false);

  #timer: ReturnType<typeof setTimeout> | null = null;

  write(value: string) {
    this.text = value;
    if (this.#timer !== null) clearTimeout(this.#timer);
    this.#timer = setTimeout(() => store.set(SCRATCH_KEY, value), SAVE_DELAY_MS);
  }
}

export const scratch = new Scratch();
