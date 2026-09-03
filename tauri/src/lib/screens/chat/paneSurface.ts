import { getContext, setContext } from "svelte";

const PANE_SURFACE = Symbol("pane-surface");

export const providePaneSurface = () => setContext(PANE_SURFACE, true);

export const inPane = (): boolean => getContext(PANE_SURFACE) === true;
