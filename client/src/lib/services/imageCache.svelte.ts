import { scaledImage } from "./imageSize";

const SIZE_SUFFIX = /@\d+$/;

const sizedKey = (key: string, pixels?: number) => (pixels ? `${key}@${pixels}` : key);

const unsizedKey = (entry: string) => entry.replace(SIZE_SUFFIX, "");

class ImageCache {
  #urls = $state<Record<string, string>>({});
  #asked = new Set<string>();

  get(key: string, pixels?: number): string | null {
    return this.#urls[sizedKey(key, pixels)] ?? null;
  }

  load(key: string, make: () => Promise<Blob | null>, pixels?: number) {
    const entry = sizedKey(key, pixels);
    if (this.#asked.has(entry)) return;
    this.#asked.add(entry);
    void make()
      .then(async (blob) => {
        if (!blob) throw new Error();
        const scaled = pixels ? await scaledImage(blob, pixels) : blob;
        const whole = scaled === blob;
        const known = whole ? this.#urls[key] : undefined;
        if (known) {
          this.#urls = { ...this.#urls, [entry]: known };
          return;
        }
        const url = URL.createObjectURL(scaled);
        const image = new Image();
        image.src = url;
        await image.decode().catch(() => undefined);
        if (whole) this.#asked.add(key);
        this.#urls = { ...this.#urls, ...(whole ? { [key]: url } : {}), [entry]: url };
      })
      .catch(() => this.#asked.delete(entry));
  }

  drop(prefix: string, spared: ReadonlySet<string> = new Set()) {
    const dropped = (entry: string) => entry.startsWith(prefix) && !spared.has(unsizedKey(entry));
    const kept: Record<string, string> = {};
    for (const [key, url] of Object.entries(this.#urls)) {
      if (dropped(key)) URL.revokeObjectURL(url);
      else kept[key] = url;
    }
    for (const key of [...this.#asked]) if (dropped(key)) this.#asked.delete(key);
    this.#urls = kept;
  }
}

export const imageCache = new ImageCache();
