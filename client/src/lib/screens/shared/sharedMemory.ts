import type { SharedEntry } from "$lib/services/sharedApi";

const listings = new Map<string, SharedEntry[]>();

export const recallShared = (slot: string): SharedEntry[] | undefined => listings.get(slot);

export const rememberShared = (slot: string, entries: SharedEntry[]) => {
  listings.set(slot, entries);
};
