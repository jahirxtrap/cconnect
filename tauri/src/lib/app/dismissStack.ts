type Handler = () => void;

const stack: Handler[] = [];

export const pushDismiss = (handler: Handler) => {
  stack.push(handler);
  return () => {
    const index = stack.lastIndexOf(handler);
    if (index >= 0) stack.splice(index, 1);
  };
};

export const dismissTop = () => {
  const handler = stack.at(-1);
  if (!handler) return false;
  handler();
  return true;
};

export const dismissOpen = () => stack.length > 0;
