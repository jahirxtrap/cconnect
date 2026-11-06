export class EnvironmentSlots<T> {
  #current: string | null = null;
  readonly #saved = new Map<string, T>();
  readonly #blank: T;
  readonly #capture: () => T;
  readonly #restore: (snapshot: T) => void;

  constructor(blank: T, capture: () => T, restore: (snapshot: T) => void) {
    this.#blank = blank;
    this.#capture = capture;
    this.#restore = restore;
  }

  get current(): string | null {
    return this.#current;
  }

  follow(next: string | null) {
    if (next === this.#current) return;
    if (this.#current !== null) this.#saved.set(this.#current, this.#capture());
    this.#current = next;
    this.#restore((next === null ? undefined : this.#saved.get(next)) ?? this.#blank);
  }

  forget(current: string | null) {
    if (current !== null) this.#saved.delete(current);
    this.#current = current;
    this.#restore(this.#blank);
  }
}
