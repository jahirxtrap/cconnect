import { backend, type Profile } from "$lib/services/backend.svelte";
import type { ClashPolicy } from "$lib/services/sharedApi";
import { uploadAttachment } from "$lib/services/uploadApi";

export type TransferKind = "upload" | "download";
export type TransferStatus = "active" | "done" | "failed";

type TransferRun = (
  onProgress: (value: number) => void,
  signal: AbortSignal,
  keep: (saved: string) => void,
) => Promise<boolean>;

export interface Transfer {
  id: number;
  kind: TransferKind;
  name: string;
  dir: string;
  url: string;
  saved: string;
  progress: number;
  status: TransferStatus;
}

class TransferManager {
  items = $state<Transfer[]>([]);
  collapsed = $state(false);

  #nextId = 0;
  #cancelled = new Set<number>();
  #aborts = new Map<number, AbortController>();
  #progressAt = new Map<number, number>();

  get active() {
    return this.items.filter((item) => item.status === "active");
  }

  get finished() {
    return this.items.filter((item) => item.status !== "active");
  }

  get progress() {
    if (!this.items.length) return 0;
    const total = this.items.reduce((sum, item) => sum + (item.status === "active" ? item.progress : 1), 0);
    return total / this.items.length;
  }

  flowingTo(prefix: string, withinMs: number) {
    const since = Date.now() - withinMs;
    return this.items.some(
      (item) => item.status === "active" && item.url.startsWith(prefix) && (this.#progressAt.get(item.id) ?? 0) > since,
    );
  }

  upload(file: File, dir: string, policy: ClashPolicy = "keep", profile: Profile = backend.active) {
    const id = this.#start("upload", file.name, dir);
    const abort = new AbortController();
    this.#aborts.set(id, abort);
    void uploadAttachment(
      file,
      (progress) => this.#patch(id, { progress }),
      profile,
      dir ? `${dir}/${file.name}` : file.name,
      abort.signal,
      policy,
    ).then((saved) => this.#settle(id, saved !== null));
  }

  async task(kind: TransferKind, name: string, run: TransferRun, url = "") {
    const id = this.#start(kind, name, "", url);
    const abort = new AbortController();
    this.#aborts.set(id, abort);
    try {
      const done = await run(
        (progress) => this.#patch(id, { progress }),
        abort.signal,
        (saved) => this.#patch(id, { saved }),
      );
      this.#settle(id, done);
      return done;
    } catch {
      this.#settle(id, false);
      return false;
    }
  }

  download(name: string, run: TransferRun, url = "") {
    return this.task("download", name, run, url);
  }

  cancel(id: number) {
    this.#cancelled.add(id);
    this.#aborts.get(id)?.abort();
    this.#aborts.delete(id);
    this.items = this.items.filter((item) => !(item.id === id && item.status === "active"));
  }

  clearFinished() {
    this.items = this.active;
  }

  dismiss() {
    this.items.filter((item) => item.status === "active").forEach((item) => this.cancel(item.id));
    this.items = [];
    this.collapsed = false;
  }

  #start(kind: TransferKind, name: string, dir: string, url = "") {
    const id = ++this.#nextId;
    this.items = [...this.items, { id, kind, name, dir, url, saved: "", progress: 0, status: "active" }];
    this.collapsed = false;
    return id;
  }

  #settle(id: number, saved: boolean) {
    this.#aborts.delete(id);
    this.#progressAt.delete(id);
    if (this.#cancelled.delete(id)) return;
    this.#patch(id, { progress: 1, status: saved ? "done" : "failed" });
  }

  #patch(id: number, patch: Partial<Transfer>) {
    if (patch.progress !== undefined) this.#progressAt.set(id, Date.now());
    this.items = this.items.map((item) => (item.id === id ? { ...item, ...patch } : item));
  }
}

export const transfers = new TransferManager();
