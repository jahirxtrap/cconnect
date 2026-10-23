import { getContext, setContext } from "svelte";

const CARD_FRAME = Symbol("card-frame");

export const insideCard = (): boolean => getContext<boolean | undefined>(CARD_FRAME) ?? false;

export const provideCardFrame = () => setContext(CARD_FRAME, true);
