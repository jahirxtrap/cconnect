type Handler = () => void;

interface Layer {
  handler: Handler;
  modal: boolean;
}

const stack: Layer[] = [];

const rewinding: number[] = [];
let settling = false;

const depth = () => (window.history.state as { dismiss?: number } | null)?.dismiss ?? 0;

const surplus = () => depth() - rewinding.reduce((sum, steps) => sum + steps, 0) - stack.length;

const settle = () => {
  settling = false;
  const extra = surplus();
  if (extra <= 0) return;
  rewinding.push(extra);
  window.history.go(-extra);
};

export const pushDismiss = (handler: Handler, { modal = true }: { modal?: boolean } = {}) => {
  const layer = { handler, modal };
  const reuse = surplus() > 0;
  stack.push(layer);
  const entry = { dismiss: stack.length };
  if (reuse) window.history.replaceState(entry, "", window.location.href);
  else window.history.pushState(entry, "", window.location.href);
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

export const consumingDismiss = () => rewinding.shift() !== undefined;

export const dismissOpen = () => stack.some((layer) => layer.modal);
