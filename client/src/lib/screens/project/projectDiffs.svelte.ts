import { untrack } from "svelte";
import { projectFilesApi, type ProjectDiff } from "$lib/services/projectFilesApi";

const PREFETCH_BATCH = 6;

const keyOf = (projectKey: string, path: string) => `${projectKey}|${path}`;

class ProjectDiffs {
  #entries = $state<Record<string, ProjectDiff>>({});
  #revisions = $state<Record<string, number>>({});
  #loading = new Map<string, Promise<void>>();

  get(projectKey: string, path: string): ProjectDiff | null {
    return this.#entries[keyOf(projectKey, path)] ?? null;
  }

  has(projectKey: string, path: string): boolean {
    return keyOf(projectKey, path) in this.#entries;
  }

  revision(projectKey: string, path: string): number {
    return this.#revisions[keyOf(projectKey, path)] ?? 0;
  }

  load(projectKey: string, path: string): Promise<void> {
    const key = keyOf(projectKey, path);
    if (untrack(() => key in this.#entries)) return Promise.resolve();
    const running = this.#loading.get(key);
    if (running) return running;
    const request = projectFilesApi
      .diff(projectKey, path)
      .then((found) => {
        this.#entries = { ...this.#entries, [key]: found ?? { added: [], removed: {} } };
      })
      .finally(() => this.#loading.delete(key));
    this.#loading.set(key, request);
    return request;
  }

  async prefetch(projectKey: string, paths: string[]) {
    const pending = untrack(() => paths.filter((path) => !(keyOf(projectKey, path) in this.#entries)));
    for (let at = 0; at < pending.length; at += PREFETCH_BATCH) {
      await Promise.all(pending.slice(at, at + PREFETCH_BATCH).map((path) => this.load(projectKey, path)));
    }
  }

  invalidate(paths: string[] | null) {
    const stale = paths === null ? Object.keys(untrack(() => this.#entries)) : null;
    const entries = { ...untrack(() => this.#entries) };
    const revisions = { ...untrack(() => this.#revisions) };
    const drop = (key: string) => {
      delete entries[key];
      revisions[key] = (revisions[key] ?? 0) + 1;
    };
    if (stale) stale.forEach(drop);
    else for (const key of Object.keys(entries)) if (paths!.some((path) => key.endsWith(`|${path}`))) drop(key);
    this.#entries = entries;
    this.#revisions = revisions;
  }
}

export const projectDiffs = new ProjectDiffs();
