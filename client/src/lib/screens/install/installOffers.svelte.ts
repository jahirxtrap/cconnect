import { installFromLink, type InstallRequest } from "$lib/data/installRequest";
import { packOffers } from "$lib/screens/packs/packOffers.svelte";
import { serverPacks } from "$lib/services/serverPacks.svelte";
import { installName } from "./installKinds";

export type ConfirmedInstall = Exclude<InstallRequest, { kind: "pack" }>;

export interface InstallOffer {
  id: number;
  request: ConfirmedInstall | null;
}

class InstallOffers {
  queue = $state<InstallOffer[]>([]);
  #next = 0;

  readonly current = $derived(this.queue[0] ?? null);

  offer(request: InstallRequest | null) {
    if (request?.kind === "pack") {
      const { url } = request;
      packOffers.offerRemote(installName(request), () => serverPacks.fetchLink(url));
      return;
    }
    this.queue = [...this.queue, { id: this.#next++, request }];
  }

  offerLink(link: string) {
    this.offer(installFromLink(link));
  }

  dismiss() {
    this.queue = this.queue.slice(1);
  }
}

export const installOffers = new InstallOffers();
