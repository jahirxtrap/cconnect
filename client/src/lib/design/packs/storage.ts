import { blobStore } from "$lib/platform/blobStore";
import { store } from "$lib/platform/storage";
import { openArchive } from "./archive";
import { builtinSource } from "./builtin";
import type { Pack } from "./model";
import type { PackSource } from "./reader";
import { BUILTIN_PACK_IDS } from "./schema";

interface Catalog {
  version: number;
  packs: Pack[];
}

const CATALOG_KEY = "packs.installed";
const CATALOG_VERSION = 1;

const archiveKey = (id: string) => `pack.${id}`;

const opened = new Map<string, Promise<PackSource | null>>();

const stored = (): Catalog | null => store.get<Catalog | null>(CATALOG_KEY, null);

export const readCatalog = (): Pack[] => {
  const catalog = stored();
  return catalog?.version === CATALOG_VERSION ? catalog.packs : [];
};

export const staleCatalog = (): string[] => {
  const catalog = stored();
  return catalog && catalog.version !== CATALOG_VERSION ? catalog.packs.map((pack) => pack.info.id) : [];
};

export const writeCatalog = (packs: Pack[]) => store.set<Catalog>(CATALOG_KEY, { version: CATALOG_VERSION, packs });

export const archiveBlob = async (id: string): Promise<Blob | null> => (await blobStore.get(archiveKey(id))) ?? null;

export const storeArchive = async (id: string, blob: Blob) => {
  await blobStore.put(archiveKey(id), blob);
  opened.delete(id);
};

export const dropArchive = async (id: string) => {
  await blobStore.remove(archiveKey(id));
  opened.delete(id);
};

export const sourceOf = (id: string): Promise<PackSource | null> => {
  let source = opened.get(id);
  if (!source) {
    source = BUILTIN_PACK_IDS.includes(id)
      ? builtinSource(id)
      : archiveBlob(id).then(async (blob) => (blob ? openArchive(new Uint8Array(await blob.arrayBuffer())) : null));
    opened.set(id, source);
  }
  return source;
};

export const packFile = async (id: string, path: string): Promise<Uint8Array | null> =>
  (await sourceOf(id))?.bytes(path) ?? null;
