import { untrack } from "svelte";
import { backend, type Profile } from "./backend.svelte";
import { relativeFromUrl, type SharedEntry } from "./sharedApi";
import { SharedWatch } from "./sharedWatch.svelte";

interface Waiter {
  name: string;
  arrive: () => void;
}

interface Follower {
  name: string;
  seen: string | null | undefined;
  changed: () => void;
}

interface Folder {
  watch: SharedWatch;
  waiters: Set<Waiter>;
  followers: Set<Follower>;
  stop: () => void;
}

interface Spot {
  key: string;
  folder: string;
  name: string;
  profile: Profile;
}

const folders = new Map<string, Folder>();

const fileOf = (entries: SharedEntry[], name: string) =>
  entries.find((entry) => entry.name === name && !entry.isDir && !entry.missing && entry.size > 0);

const signatureOf = (entries: SharedEntry[], name: string) => {
  const entry = fileOf(entries, name);
  return entry ? `${entry.size}:${entry.modified}` : null;
};

const close = (key: string) => {
  const folder = folders.get(key);
  if (!folder || folder.waiters.size || folder.followers.size) return;
  folders.delete(key);
  folder.stop();
  folder.watch.close();
};

const settle = (key: string, entries: SharedEntry[]) => {
  const folder = folders.get(key);
  if (!folder) return;
  const ready = [...folder.waiters].filter((waiter) => fileOf(entries, waiter.name));
  for (const waiter of ready) folder.waiters.delete(waiter);
  const changed = [...folder.followers].filter((follower) => {
    const before = follower.seen;
    follower.seen = signatureOf(entries, follower.name);
    return before !== undefined && follower.seen !== null && follower.seen !== before;
  });
  close(key);
  for (const waiter of ready) waiter.arrive();
  for (const follower of changed) follower.changed();
};

const open = ({ key, folder, profile }: Spot): Folder => {
  const watch = new SharedWatch(() => profile);
  const stop = $effect.root(() => {
    $effect(() => {
      const entries = watch.entries;
      if (entries) untrack(() => settle(key, entries));
    });
  });
  const opened = { watch, waiters: new Set<Waiter>(), followers: new Set<Follower>(), stop };
  folders.set(key, opened);
  watch.connect();
  watch.watch(folder);
  return opened;
};

const locate = (url: string): Spot | null => {
  const profile = backend.sharedProfileOf(url);
  const path = relativeFromUrl(url, profile);
  if (!path) return null;
  const cut = path.lastIndexOf("/");
  const folder = cut < 0 ? "" : path.slice(0, cut);
  return { key: `${profile?.id ?? ""}|${folder}`, folder, name: path.slice(cut + 1), profile };
};

export const awaitSharedFile = (url: string, arrive: () => void): (() => void) => {
  const spot = locate(url);
  if (!spot) return () => undefined;
  const waiter = { name: spot.name, arrive };
  (folders.get(spot.key) ?? open(spot)).waiters.add(waiter);
  return () => {
    folders.get(spot.key)?.waiters.delete(waiter);
    close(spot.key);
  };
};

export const followSharedFile = (url: string, changed: () => void): (() => void) => {
  const spot = locate(url);
  if (!spot) return () => undefined;
  const folder = folders.get(spot.key) ?? open(spot);
  const entries = folder.watch.entries;
  const follower: Follower = { name: spot.name, seen: entries ? signatureOf(entries, spot.name) : undefined, changed };
  folder.followers.add(follower);
  return () => {
    folders.get(spot.key)?.followers.delete(follower);
    close(spot.key);
  };
};
