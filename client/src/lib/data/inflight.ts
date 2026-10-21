export class Inflight {
  #count = 0;
  #idle: (() => void)[] = [];

  async track<T>(work: Promise<T>): Promise<T> {
    this.#count++;
    try {
      return await work;
    } finally {
      this.#count--;
      if (!this.#count) for (const resolve of this.#idle.splice(0)) resolve();
    }
  }

  settled(): Promise<void> {
    return this.#count ? new Promise((resolve) => this.#idle.push(resolve)) : Promise.resolve();
  }
}

export const loads = new Inflight();
