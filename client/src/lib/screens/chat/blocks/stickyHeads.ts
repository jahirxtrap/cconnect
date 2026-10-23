import { getContext, setContext } from "svelte";

const STICKY_HEADS = Symbol("sticky-heads");

export const provideStickyHeads = (enabled: boolean) => setContext(STICKY_HEADS, enabled);

export const stickyHeads = (): boolean => getContext<boolean | undefined>(STICKY_HEADS) ?? false;
