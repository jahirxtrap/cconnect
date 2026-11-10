import { getContext, setContext, untrack, type Snippet } from "svelte";
import { pushDismiss } from "$lib/app/dismissStack";

interface DrillLevel {
  text: string;
  children: Snippet;
  footer?: Snippet;
  value: () => string | undefined;
  release: () => void;
}

const KEY = Symbol("menu-drill");

export class MenuDrill {
  levels = $state<DrillLevel[]>([]);

  readonly current = $derived(this.levels.at(-1) ?? null);

  open(text: string, children: Snippet, footer: Snippet | undefined, value: () => string | undefined) {
    const release = pushDismiss(() => this.back());
    this.levels = [...this.levels, { text, children, footer, value, release }];
  }

  back() {
    const last = this.levels.at(-1);
    if (!last) return;
    this.levels = this.levels.slice(0, -1);
    last.release();
  }

  release() {
    for (const level of untrack(() => this.levels).toReversed()) level.release();
  }

  reset() {
    const levels = untrack(() => this.levels);
    if (!levels.length) return;
    this.levels = [];
    for (const level of levels.toReversed()) level.release();
  }
}

export const provideMenuDrill = (): MenuDrill => setContext(KEY, new MenuDrill());

export const menuDrill = (): MenuDrill | undefined => getContext<MenuDrill | undefined>(KEY);
