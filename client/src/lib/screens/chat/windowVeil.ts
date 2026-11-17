import { getContext, setContext, type Snippet } from "svelte";
import type { VeilLook } from "$lib/design/backgrounds";

const WINDOW_VEIL = Symbol("window-veil");

export interface WindowVeil {
  veil: () => VeilLook | null;
  column: () => boolean;
  still: Snippet;
}

export const provideWindowVeil = (veil: WindowVeil) => setContext(WINDOW_VEIL, veil);

export const windowVeil = (): WindowVeil | null => getContext<WindowVeil | undefined>(WINDOW_VEIL) ?? null;
