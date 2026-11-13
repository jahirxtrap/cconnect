import { pendingRewind, pushEntry, replaceEntry, rewind } from "./historyLedger";

type Handler = () => void;

interface Layer {
  handler: Handler;
  modal: boolean;
}

const stack: Layer[] = [];

let settling = false;

const depth = () => (window.history.state as { dismiss?: number } | null)?.dismiss ?? 0;

const surplus = () => depth() - pendingRewind() - stack.length;

const settle = () => {
  settling = false;
  const extra = surplus();
  if (extra > 0) rewind(extra);
};

export const pushDismiss = (handler: Handler, { modal = true }: { modal?: boolean } = {}) => {
  const layer = { handler, modal };
  const reuse = surplus() > 0;
  stack.push(layer);
  const entry = { dismiss: stack.length };
  if (reuse) replaceEntry(entry, window.location.href);
  else pushEntry(entry, window.location.href);
  return () => {
    const index = stack.lastIndexOf(layer);
    if (index < 0) return;
    stack.splice(index, 1);
    if (settling) return;
    settling = true;
    queueMicrotask(settle);
  };
};

export const dismissTop = () => {
  const layer = stack.at(-1);
  if (!layer) return false;
  layer.handler();
  return true;
};

export const dismissOpen = () => stack.some((layer) => layer.modal);
