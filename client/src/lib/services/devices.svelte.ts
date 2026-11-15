import { untrack } from "svelte";
import { toDevicesState, type DevicesState } from "$lib/data/deviceModels";
import { keyRefused } from "$lib/data/keyGate.svelte";
import { securityKeys } from "$lib/data/securityKeys.svelte";
import { backend, type Profile } from "./backend.svelte";
import { createDevicesApi } from "./devicesApi";
import { ReconnectingSocket } from "./socket";

const slotOf = (profile: Profile, key = securityKeys.keyFor(profile)) => [profile?.id ?? "", key].join("|");

class Devices {
  #states = $state<Record<string, DevicesState>>({});
  #refused = $state<Record<string, boolean>>({});
  #failed = $state<Record<string, boolean>>({});
  #opened = $state<Record<string, string | null>>({});

  stateOf(profile: Profile): DevicesState | null {
    if (!profile) return null;
    const slot = slotOf(profile);
    const stale = this.#refused[slot] === true && securityKeys.unlocked(profile) !== false;
    return stale ? null : (this.#states[slot] ?? null);
  }

  failed(profile: Profile): boolean {
    return profile ? this.#failed[profile.id] === true : false;
  }

  openedOf(profile: Profile): string | null {
    return profile ? (this.#opened[profile.id] ?? null) : null;
  }

  open(profile: Profile, serial: string | null) {
    if (profile) this.#opened = { ...this.#opened, [profile.id]: serial };
  }

  adopt(profile: Profile, state: DevicesState, key = securityKeys.keyFor(profile)) {
    if (!profile) return;
    const slot = slotOf(profile, key);
    this.#states = { ...untrack(() => this.#states), [slot]: state };
    this.#refused = { ...untrack(() => this.#refused), [slot]: false };
  }

  async refresh(profile: Profile = backend.active, key = securityKeys.keyFor(profile)): Promise<boolean> {
    if (!profile) return false;
    untrack(() => (this.#failed = { ...this.#failed, [profile.id]: false }));
    const result = await createDevicesApi(() => profile).state(key);
    const refused = keyRefused(result);
    if (result.ok) this.adopt(profile, result.value, key);
    else if (refused) this.#refused = { ...this.#refused, [slotOf(profile, key)]: true };
    this.#failed = { ...this.#failed, [profile.id]: !result.ok && !refused };
    return !refused;
  }

  connect(profile: Profile): () => void {
    if (!profile) return () => {};
    const key = securityKeys.keyFor(profile);
    const socket = new ReconnectingSocket(
      "/devices/ws",
      {
        onOpen: () => socket.send({ key }),
        onMessage: (message) => {
          if (message.type === "state") this.adopt(profile, toDevicesState(message), key);
        },
      },
      () => profile,
    );
    socket.connect();
    return () => socket.close();
  }
}

export const devices = new Devices();
