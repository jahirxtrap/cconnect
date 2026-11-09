import {
  DEFAULT_BACKGROUND,
  DEFAULT_EFFECTS,
  NO_BACKGROUND,
  sameEffects,
  UPLOAD_EFFECTS,
  type BackgroundEffects,
} from "$lib/design/backgrounds";
import { packs } from "$lib/design/packs/registry.svelte";
import { packFile, packImageKey } from "$lib/design/packs/storage";
import { blobStore } from "$lib/platform/blobStore";
import { store } from "$lib/platform/storage";
import { imageCache } from "$lib/services/imageCache.svelte";
import { scaledImage } from "$lib/services/imageSize";
import { guessMimeType } from "./previewKind";

const SELECTED_KEY = "chat.background";
const EFFECTS_KEY = "chat.background_effects";
const UPLOADS_KEY = "chat.backgrounds";
const UPLOAD_PREFIX = "mine/";
const MAX_SIDE = 2560;
const IMAGE_TYPE = "image/jpeg";

const uploadKey = (id: string) => `background.${id}`;

const without = <T>(record: Record<string, T>, key: string): Record<string, T> =>
  Object.fromEntries(Object.entries(record).filter(([entry]) => entry !== key));

class ChatBackground {
  selected = $state<string>(store.get(SELECTED_KEY, DEFAULT_BACKGROUND));
  saved = $state<Record<string, BackgroundEffects>>(store.get(EFFECTS_KEY, {}));
  uploads = $state<string[]>(store.get(UPLOADS_KEY, []));

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

  #imageKey(id: string): string | null {
    if (this.isUpload(id)) return uploadKey(id);
    const background = packs.backgroundOf(id);
    return background?.file ? packImageKey(background.pack, background.file) : null;
  }

  imageOf(id: string, pixels?: number): string | null {
    const key = this.#imageKey(id);
    return key ? imageCache.get(key, pixels) : null;
  }

  loadImage(id: string, pixels?: number) {
    const key = this.#imageKey(id);
    if (key) imageCache.load(key, () => this.#blobOf(id), pixels);
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
    await this.restore(id, await scaledImage(file, MAX_SIDE, "long", IMAGE_TYPE));
    return id;
  }

  async restore(id: string, blob: Blob) {
    await blobStore.put(uploadKey(id), blob);
    imageCache.drop(uploadKey(id));
    if (!this.uploads.includes(id)) this.#keepUploads([...this.uploads, id]);
  }

  async remove(id: string) {
    await blobStore.remove(uploadKey(id));
    this.forget(id);
    this.#keepEffects(without(this.saved, id));
    this.#keepUploads(this.uploads.filter((upload) => upload !== id));
  }

  forget(id: string) {
    const key = this.#imageKey(id);
    if (key) imageCache.drop(key);
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
