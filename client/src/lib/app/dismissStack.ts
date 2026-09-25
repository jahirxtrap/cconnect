type Handler = () => void;

interface Layer {
  handler: Handler;
  modal: boolean;
}

const stack: Layer[] = [];

let consuming = false;

const depth = () => (window.history.state as { dismiss?: number } | null)?.dismiss ?? 0;

export const pushDismiss = (handler: Handler, { modal = true }: { modal?: boolean } = {}) => {
  const layer = { handler, modal };
  stack.push(layer);
  window.history.pushState({ dismiss: stack.length }, "", window.location.href);
  return () => {
    const index = stack.lastIndexOf(layer);
    if (index < 0) return;
    stack.splice(index, 1);
    if (depth() <= stack.length) return;
    consuming = true;
    window.history.back();
  };
};

export const dismissTop = () => {
  const layer = stack.at(-1);
  if (!layer) return false;
  layer.handler();
  return true;
};

export const consumingDismiss = () => {
  if (!consuming) return false;
  consuming = false;
  return true;
};

export const dismissOpen = () => stack.some((layer) => layer.modal);
