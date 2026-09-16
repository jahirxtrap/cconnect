import { untrack } from "svelte";
import { projectFilesApi, type ProjectDiff } from "$lib/services/projectFilesApi";

const PREFETCH_BATCH = 6;

const keyOf = (projectKey: string, path: string) => `${projectKey}|${path}`;

class ProjectDiffs {
  #entries = $state<Record<string, ProjectDiff>>({});
  #revisions = $state<Record<string, number>>({});
  #loaded = $state<Record<string, number>>({});
  #loading = new Map<string, { at: number; request: Promise<void> }>();

  get(projectKey: string, path: string): ProjectDiff | null {
    return this.#entries[keyOf(projectKey, path)] ?? null;
  }

  has(projectKey: string, path: string): boolean {
    const key = keyOf(projectKey, path);
    return key in this.#entries && this.#loaded[key] === this.revision(projectKey, path);
  }

  revision(projectKey: string, path: string): number {
    return this.#revisions[keyOf(projectKey, path)] ?? 0;
  }

  load(projectKey: string, path: string): Promise<void> {
    const key = keyOf(projectKey, path);
    const at = untrack(() => this.revision(projectKey, path));
    if (untrack(() => this.#loaded[key]) === at) return Promise.resolve();
    const running = this.#loading.get(key);
    if (running?.at === at) return running.request;
    const request = projectFilesApi
      .diff(projectKey, path)
      .then((found) => {
        if (untrack(() => this.revision(projectKey, path)) !== at) return;
        this.#entries = { ...this.#entries, [key]: found ?? { added: [], removed: {} } };
        this.#loaded = { ...this.#loaded, [key]: at };
      })
      .finally(() => {
        if (this.#loading.get(key)?.at === at) this.#loading.delete(key);
      });
    this.#loading.set(key, { at, request });
    return request;
  }

  async prefetch(projectKey: string, paths: string[]) {
    const pending = untrack(() =>
      paths.filter((path) => this.#loaded[keyOf(projectKey, path)] !== this.revision(projectKey, path)),
    );
    for (let at = 0; at < pending.length; at += PREFETCH_BATCH) {
      await Promise.all(pending.slice(at, at + PREFETCH_BATCH).map((path) => this.load(projectKey, path)));
    }
  }

  invalidate(paths: string[] | null) {
    const revisions = { ...untrack(() => this.#revisions) };
    const keys = untrack(() => Object.keys(this.#entries));
    const stale = paths === null ? keys : keys.filter((key) => paths.some((path) => key.endsWith(`|${path}`)));
    for (const key of stale) revisions[key] = (revisions[key] ?? 0) + 1;
    this.#revisions = revisions;
  }
}

export const projectDiffs = new ProjectDiffs();
