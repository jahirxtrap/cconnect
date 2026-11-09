import { getContext, setContext, type Snippet } from "svelte";

import { layout } from "$lib/platform/layout.svelte";
import type { PaneRole } from "./tabs.svelte";

const PANE_SURFACE = Symbol("pane-surface");
const PANE_TAIL = Symbol("pane-tail");

export const providePaneSurface = (role: PaneRole = "right") => setContext(PANE_SURFACE, role);

export const paneRole = (): PaneRole | null => (getContext(PANE_SURFACE) as PaneRole) ?? null;

export const inPane = (): boolean => paneRole() !== null;

export const compactPane = (role: PaneRole, plain: boolean): boolean => role === "right" && !plain && !layout.mobile;

export const providePaneTail = (tail: () => Snippet | null) => setContext(PANE_TAIL, tail);

export const usePaneTail = (): (() => Snippet | null) =>
  (getContext(PANE_TAIL) as (() => Snippet | null) | undefined) ?? (() => null);
