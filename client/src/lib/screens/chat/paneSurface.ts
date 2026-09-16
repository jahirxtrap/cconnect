import { getContext, setContext } from "svelte";

import type { PaneRole } from "./tabs.svelte";

const PANE_SURFACE = Symbol("pane-surface");

export const providePaneSurface = (role: PaneRole = "right") => setContext(PANE_SURFACE, role);

export const paneRole = (): PaneRole | null => (getContext(PANE_SURFACE) as PaneRole) ?? null;

export const inPane = (): boolean => paneRole() !== null;
