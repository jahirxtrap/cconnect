import {
  DEFAULT_BACKGROUND,
  DEFAULT_EFFECTS,
  NO_BACKGROUND,
  sameEffects,
  UPLOAD_EFFECTS,
  type BackgroundEffects,
} from "$lib/design/backgrounds";
import { packs } from "$lib/design/packs/registry.svelte";
import { packFile } from "$lib/design/packs/storage";
import { blobStore } from "$lib/platform/blobStore";
import { store } from "$lib/platform/storage";
import { guessMimeType } from "./previewKind";

const SELECTED_KEY = "chat.background";
const EFFECTS_KEY = "chat.background_effects";
const UPLOADS_KEY = "chat.backgrounds";
const UPLOAD_PREFIX = "mine/";
const MAX_SIDE = 2560;
const QUALITY = 0.85;
const IMAGE_TYPE = "image/jpeg";

const uploadKey = (id: string) => `background.${id}`;

const reduced = async (file: Blob): Promise<Blob> => {
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob ?? file), IMAGE_TYPE, QUALITY));
};

const without = <T>(record: Record<string, T>, key: string): Record<string, T> =>
  Object.fromEntries(Object.entries(record).filter(([entry]) => entry !== key));

class ChatBackground {
  selected = $state<string>(store.get(SELECTED_KEY, DEFAULT_BACKGROUND));
  saved = $state<Record<string, BackgroundEffects>>(store.get(EFFECTS_KEY, {}));
  uploads = $state<string[]>(store.get(UPLOADS_KEY, []));
  urls = $state<Record<string, string>>({});
  #loading = new Map<string, Promise<void>>();

  readonly current = $derived(this.exists(this.selected) ? this.selected : DEFAULT_BACKGROUND);
  readonly effects = $derived(this.effectsOf(this.current));

  exists(id: string): boolean {
    return id === NO_BACKGROUND || this.uploads.includes(id) || packs.backgroundOf(id) !== undefined;
  }

  isUpload(id: string): boolean {
    return this.uploads.includes(id);
  }

  isImage(id: string): boolean {
    return this.isUpload(id) || !!packs.backgroundOf(id)?.file;
  }

  defaultsOf(id: string): BackgroundEffects {
    if (this.isUpload(id)) return UPLOAD_EFFECTS;
    return { ...DEFAULT_EFFECTS, ...packs.backgroundOf(id)?.effects };
  }

  effectsOf(id: string): BackgroundEffects {
    return this.saved[id] ?? this.defaultsOf(id);
  }

  ensure(id: string = this.current): Promise<void> {
    if (this.urls[id] || !this.isImage(id)) return Promise.resolve();
    let loading = this.#loading.get(id);
    if (!loading) {
      loading = this.#blobOf(id).then((blob) => {
        if (blob) this.urls = { ...this.urls, [id]: URL.createObjectURL(blob) };
      });
      this.#loading.set(id, loading);
    }
    return loading;
  }

  async #blobOf(id: string): Promise<Blob | null> {
    if (this.isUpload(id)) return (await blobStore.get(uploadKey(id))) ?? null;
    const background = packs.backgroundOf(id);
    const data = background?.file ? await packFile(background.pack, background.file) : null;
    return data && background?.file ? new Blob([data as BlobPart], { type: guessMimeType(background.file) ?? "" }) : null;
  }

  #select(id: string) {
    this.selected = id;
    store.set(SELECTED_KEY, id);
  }

  apply(selected: string, edited: Record<string, BackgroundEffects>) {
    this.#select(selected);
    const saved = { ...this.saved };
    for (const [id, effects] of Object.entries(edited)) {
      if (sameEffects(effects, this.defaultsOf(id))) delete saved[id];
      else saved[id] = effects;
    }
    this.#keepEffects(saved);
  }

  #keepEffects(saved: Record<string, BackgroundEffects>) {
    this.saved = saved;
    store.set(EFFECTS_KEY, saved);
  }

  #keepUploads(uploads: string[]) {
    this.uploads = uploads;
    store.set(UPLOADS_KEY, uploads);
  }

  async upload(file: Blob): Promise<string> {
    const id = `${UPLOAD_PREFIX}${crypto.randomUUID()}`;
    await this.restore(id, await reduced(file));
    return id;
  }

  async restore(id: string, blob: Blob) {
    await blobStore.put(uploadKey(id), blob);
    if (!this.uploads.includes(id)) this.#keepUploads([...this.uploads, id]);
  }

  async remove(id: string) {
    await blobStore.remove(uploadKey(id));
    if (this.urls[id]) URL.revokeObjectURL(this.urls[id]);
    this.urls = without(this.urls, id);
    this.#loading.delete(id);
    this.#keepEffects(without(this.saved, id));
    this.#keepUploads(this.uploads.filter((upload) => upload !== id));
  }

  async uploadedImages(): Promise<{ id: string; blob: Blob }[]> {
    const images = await Promise.all(
      this.uploads.map(async (id) => ({ id, blob: (await blobStore.get(uploadKey(id))) ?? null })),
    );
    return images.filter((image): image is { id: string; blob: Blob } => image.blob !== null);
  }

  reset() {
    this.#select(DEFAULT_BACKGROUND);
    this.#keepEffects({});
  }
}

export const chatBackground = new ChatBackground();
