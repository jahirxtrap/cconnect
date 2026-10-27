export interface PackOffer {
  id: number;
  name: string;
  load: () => Promise<Blob | null>;
  remote: boolean;
  url: string | null;
}

class PackOffers {
  queue = $state<PackOffer[]>([]);
  #next = 0;

  readonly current = $derived(this.queue[0] ?? null);

  offer(name: string, load: () => Promise<Blob | null>) {
    this.#add({ name, load, remote: false, url: null });
  }

  offerRemote(name: string, load: () => Promise<Blob | null>, url: string | null = null) {
    this.#add({ name, load, remote: true, url });
  }

  #add(offer: Omit<PackOffer, "id">) {
    this.queue = [...this.queue, { ...offer, id: this.#next++ }];
  }

  dismiss() {
    this.queue = this.queue.slice(1);
  }
}

export const packOffers = new PackOffers();
