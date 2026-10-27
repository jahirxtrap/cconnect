import { getContext, setContext } from "svelte";

const DIALOG_SETTLED = Symbol("dialog-settled");

export const provideDialogSettled = (settled: () => boolean) => setContext(DIALOG_SETTLED, settled);

export const dialogSettled = (): (() => boolean) =>
  getContext<(() => boolean) | undefined>(DIALOG_SETTLED) ?? (() => true);
