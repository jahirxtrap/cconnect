class ImageCache {
  #urls = $state<Record<string, string>>({});
  #asked = new Set<string>();

  get(key: string): string | null {
    return this.#urls[key] ?? null;
  }

  load(key: string, make: () => Promise<Blob | null>) {
    if (this.#asked.has(key)) return;
    this.#asked.add(key);
    void make()
      .then(async (blob) => {
        if (!blob) throw new Error();
        const url = URL.createObjectURL(blob);
        const image = new Image();
        image.src = url;
        await image.decode().catch(() => undefined);
        this.#urls = { ...this.#urls, [key]: url };
      })
      .catch(() => this.#asked.delete(key));
  }

  drop(prefix: string) {
    const kept: Record<string, string> = {};
    for (const [key, url] of Object.entries(this.#urls)) {
      if (key.startsWith(prefix)) URL.revokeObjectURL(url);
      else kept[key] = url;
    }
    for (const key of [...this.#asked]) if (key.startsWith(prefix)) this.#asked.delete(key);
    this.#urls = kept;
  }
}

export const imageCache = new ImageCache();
