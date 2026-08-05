import { backend, type Profile } from "$lib/services/backend.svelte";
import { uploadAttachment } from "$lib/services/uploadApi";

export type UploadStatus = "uploading" | "done" | "failed";

export interface Upload {
  id: number;
  name: string;
  dir: string;
  progress: number;
  status: UploadStatus;
}

class UploadManager {
  items = $state<Upload[]>([]);

  #nextId = 0;
  #cancelled = new Set<number>();
  #aborts = new Map<number, AbortController>();

  enqueue(file: File, dir: string, profile: Profile = backend.active) {
    const id = ++this.#nextId;
    const abort = new AbortController();
    this.#aborts.set(id, abort);
    this.items = [...this.items, { id, name: file.name, dir, progress: 0, status: "uploading" }];
    void uploadAttachment(
      file,
      (progress) => this.#patch(id, { progress }),
      profile,
      dir ? `${dir}/${file.name}` : file.name,
      abort.signal,
    ).then((saved) => {
      this.#aborts.delete(id);
      if (this.#cancelled.delete(id)) return;
      this.#patch(id, { progress: 1, status: saved !== null ? "done" : "failed" });
    });
  }

  cancel(id: number) {
    this.#cancelled.add(id);
    this.#aborts.get(id)?.abort();
    this.#aborts.delete(id);
    this.items = this.items.filter((item) => !(item.id === id && item.status === "uploading"));
  }

  clearFinished() {
    this.items = this.items.filter((item) => item.status === "uploading");
  }

  #patch(id: number, patch: Partial<Upload>) {
    this.items = this.items.map((item) => (item.id === id ? { ...item, ...patch } : item));
  }
}

export const uploads = new UploadManager();
