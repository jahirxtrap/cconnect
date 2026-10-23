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

const MIN_REFRESH_MS = 600;

export const holdRefresh = async (work: Promise<unknown>) => {
  await Promise.all([work, new Promise((done) => setTimeout(done, MIN_REFRESH_MS))]);
};

export const pendingRefresh = () => {
  let finish = () => {};
  const held = holdRefresh(new Promise<void>((done) => (finish = done)));
  return { finish, held };
};
