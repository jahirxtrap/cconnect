import { APP_VERSION } from "$lib/data/build";
import { isMobile, isTauri } from "$lib/platform";
import { androidInstaller, trackAndroidInstall } from "$lib/platform/androidInstaller";
import { store } from "$lib/platform/storage";

interface Pending {
  version: string;
  path: string;
}

const PENDING_KEY = "update.pending";

const compare = (a: string, b: string) => {
  const left = a.split(".").map(Number);
  const right = b.split(".").map(Number);
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    const diff = (left[i] ?? 0) - (right[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
};

class Updater {
  progress = $state<number | null>(null);
  pending = $state<Pending | null>(store.get<Pending | null>(PENDING_KEY, null));
  cancelled = $state(false);

  #abort: AbortController | null = null;

  async consumeIfInstalled() {
    const current = this.pending;
    if (!current) return;
    if (compare(APP_VERSION, current.version) >= 0) {
      this.#clear();
      return;
    }
    if (!isTauri || isMobile) return;
    const { exists } = await import("@tauri-apps/plugin-fs");
    const there = await exists(current.path).catch(() => false);
    if (!there) this.#clear();
  }

  cancel() {
    this.cancelled = true;
    this.#abort?.abort();
    androidInstaller()?.cancel();
  }

  async reload() {
    if ("caches" in window) {
      const keys = await caches.keys().catch(() => [] as string[]);
      await Promise.all(keys.map((key) => caches.delete(key)));
    }
    location.reload();
  }

  async download(url: string, version: string): Promise<boolean> {
    if (!isTauri) return false;
    this.cancelled = false;
    if (isMobile) {
      const bridge = androidInstaller();
      if (!bridge) {
        const { openUrl } = await import("@tauri-apps/plugin-opener");
        return openUrl(url).then(
          () => true,
          () => false,
        );
      }
      this.progress = 0;
      bridge.start(url);
      const done = await trackAndroidInstall(bridge, (value) => (this.progress = value));
      this.progress = null;
      if (!done) {
        this.#clear();
        return false;
      }
      this.pending = { version, path: url };
      store.set(PENDING_KEY, this.pending);
      return true;
    }
    const name = url.split("/").pop() || "CConnect-update";
    this.progress = 0;
    try {
      const [{ appDataDir, join }, fs, { fetch }] = await Promise.all([
        import("@tauri-apps/api/path"),
        import("@tauri-apps/plugin-fs"),
        import("@tauri-apps/plugin-http"),
      ]);
      const directory = await join(await appDataDir(), "updates");
      await fs.mkdir(directory, { recursive: true });
      const target = await join(directory, name);

      const controller = new AbortController();
      this.#abort = controller;
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok || !response.body) throw new Error(String(response.status));
      const total = Number(response.headers.get("content-length") ?? 0);

      const chunks: Uint8Array[] = [];
      let received = 0;
      const reader = response.body.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        received += value.length;
        if (total > 0) this.progress = received / total;
      }

      const blob = new Uint8Array(received);
      let offset = 0;
      for (const chunk of chunks) {
        blob.set(chunk, offset);
        offset += chunk.length;
      }
      await fs.writeFile(target, blob);

      this.pending = { version, path: target };
      store.set(PENDING_KEY, this.pending);
      this.progress = null;
      return true;
    } catch {
      this.#clear();
      return false;
    } finally {
      this.#abort = null;
    }
  }

  async install(): Promise<boolean> {
    const current = this.pending;
    if (!current || !isTauri) return false;
    const bridge = androidInstaller();
    if (bridge) return bridge.install();
    const { invoke } = await import("@tauri-apps/api/core");
    return invoke("install_update", { path: current.path })
      .then(() => true)
      .catch(() => {
        this.#clear();
        return false;
      });
  }

  #clear() {
    this.pending = null;
    this.progress = null;
    store.set(PENDING_KEY, null);
  }
}

export const updater = new Updater();
