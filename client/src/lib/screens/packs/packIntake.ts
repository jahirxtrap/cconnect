import { extensionOf } from "$lib/data/previewKind";
import { holdsManifest } from "$lib/design/packs/archive";
import { isPackFile, PACK_MIME } from "$lib/design/packs/schema";
import { fetchShared } from "$lib/services/sharedFiles";
import { packOffers } from "./packOffers.svelte";

const ZIP = "zip";

const isZip = (file: File): boolean => extensionOf(file.name) === ZIP || file.type === PACK_MIME;

const isPack = async (file: File): Promise<boolean> =>
  isPackFile(file.name) || (isZip(file) && holdsManifest(new Uint8Array(await file.arrayBuffer())));

export const offerFiles = (files: File[]) => {
  for (const file of files) packOffers.offer(file.name, () => Promise.resolve(file));
};

export const offerShared = (url: string, name: string) => packOffers.offer(name, () => fetchShared(url), url);

export const takePacks = async (files: File[]): Promise<File[]> => {
  const rest: File[] = [];
  for (const file of files) {
    if (await isPack(file)) offerFiles([file]);
    else rest.push(file);
  }
  return rest;
};
