import { backend, type Profile } from "$lib/services/backend.svelte";
import { uploadAttachment } from "$lib/services/uploadApi";

export type TransferKind = "upload" | "download";
export type TransferStatus = "active" | "done" | "failed";

export interface Transfer {
  id: number;
  kind: TransferKind;
  name: string;
  dir: string;
  progress: number;
  status: TransferStatus;
}

class TransferManager {
  items = $state<Transfer[]>([]);
  collapsed = $state(false);

  #nextId = 0;
  #cancelled = new Set<number>();
  #aborts = new Map<number, AbortController>();

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

  upload(file: File, dir: string, profile: Profile = backend.active) {
    const id = this.#start("upload", file.name, dir);
    const abort = new AbortController();
    this.#aborts.set(id, abort);
    void uploadAttachment(
      file,
      (progress) => this.#patch(id, { progress }),
      profile,
      dir ? `${dir}/${file.name}` : file.name,
      abort.signal,
    ).then((saved) => this.#settle(id, saved !== null));
  }

  async download(name: string, run: (onProgress: (value: number) => void, signal: AbortSignal) => Promise<boolean>) {
    const id = this.#start("download", name, "");
    const abort = new AbortController();
    this.#aborts.set(id, abort);
    const saved = await run((progress) => this.#patch(id, { progress }), abort.signal);
    this.#settle(id, saved);
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

  #start(kind: TransferKind, name: string, dir: string) {
    const id = ++this.#nextId;
    this.items = [...this.items, { id, kind, name, dir, progress: 0, status: "active" }];
    this.collapsed = false;
    return id;
  }

  #settle(id: number, saved: boolean) {
    this.#aborts.delete(id);
    if (this.#cancelled.delete(id)) return;
    this.#patch(id, { progress: 1, status: saved ? "done" : "failed" });
  }

  #patch(id: number, patch: Partial<Transfer>) {
    this.items = this.items.map((item) => (item.id === id ? { ...item, ...patch } : item));
  }
}

export const transfers = new TransferManager();
