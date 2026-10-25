export interface PackOffer {
  id: number;
  name: string;
  load: () => Promise<Blob | null>;
  url: string | null;
}

class PackOffers {
  queue = $state<PackOffer[]>([]);
  #next = 0;

  readonly current = $derived(this.queue[0] ?? null);

  offer(name: string, load: () => Promise<Blob | null>, url: string | null = null) {
    this.queue = [...this.queue, { id: this.#next++, name, load, url }];
  }

  dismiss() {
    this.queue = this.queue.slice(1);
  }
}

export const packOffers = new PackOffers();
