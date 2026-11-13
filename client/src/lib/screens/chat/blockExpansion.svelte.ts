export class BlockExpansion {
  #open = $state<Record<number, boolean>>({});

  get open(): Readonly<Record<number, boolean>> {
    return this.#open;
  }

  isOpen(id: number) {
    return this.#open[id] ?? false;
  }

  set(id: number, open: boolean) {
    this.#open[id] = open;
  }

  clear() {
    this.#open = {};
  }
}
