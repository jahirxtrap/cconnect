import { untrack } from "svelte";
import { backend, type Profile } from "./backend.svelte";
import { relativeFromUrl, type SharedEntry } from "./sharedApi";
import { SharedWatch } from "./sharedWatch.svelte";

interface Waiter {
  name: string;
  arrive: () => void;
}

interface Folder {
  watch: SharedWatch;
  waiters: Set<Waiter>;
  stop: () => void;
}

const folders = new Map<string, Folder>();

const arrived = (entries: SharedEntry[], name: string) =>
  entries.some((entry) => entry.name === name && !entry.isDir && !entry.missing && entry.size > 0);

const close = (key: string) => {
  const folder = folders.get(key);
  if (!folder || folder.waiters.size) return;
  folders.delete(key);
  folder.stop();
  folder.watch.close();
};

const settle = (key: string, entries: SharedEntry[]) => {
  const folder = folders.get(key);
  if (!folder) return;
  const ready = [...folder.waiters].filter((waiter) => arrived(entries, waiter.name));
  for (const waiter of ready) folder.waiters.delete(waiter);
  close(key);
  for (const waiter of ready) waiter.arrive();
};

const open = (key: string, folder: string, profile: Profile): Folder => {
  const watch = new SharedWatch(() => profile);
  const stop = $effect.root(() => {
    $effect(() => {
      const entries = watch.entries;
      if (entries) untrack(() => settle(key, entries));
    });
  });
  const opened = { watch, waiters: new Set<Waiter>(), stop };
  folders.set(key, opened);
  watch.connect();
  watch.watch(folder);
  return opened;
};

export const awaitSharedFile = (url: string, arrive: () => void): (() => void) => {
  const profile = backend.sharedProfileOf(url);
  const path = relativeFromUrl(url, profile);
  if (!path) return () => undefined;
  const cut = path.lastIndexOf("/");
  const folder = cut < 0 ? "" : path.slice(0, cut);
  const key = `${profile?.id ?? ""}|${folder}`;
  const waiter = { name: path.slice(cut + 1), arrive };
  (folders.get(key) ?? open(key, folder, profile)).waiters.add(waiter);
  return () => {
    folders.get(key)?.waiters.delete(waiter);
    close(key);
  };
};
