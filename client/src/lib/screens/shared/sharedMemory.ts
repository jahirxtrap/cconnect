import { Recent } from "$lib/data/recent";
import type { SharedEntry } from "$lib/services/sharedApi";

const REMEMBERED = 50;

const listings = new Recent<string, SharedEntry[]>(REMEMBERED);

export const recallShared = (slot: string): SharedEntry[] | undefined => listings.get(slot);

export const rememberShared = (slot: string, entries: SharedEntry[]) => {
  listings.set(slot, entries);
};
