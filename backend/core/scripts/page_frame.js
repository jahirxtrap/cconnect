(() => {
  const CHANNEL = 'cconnect-frame';
  const SYMBOLS = { '+': 'Equal', '=': 'Equal', '-': 'Minus' };
  let wanted = [];
  const codeOf = (event) =>
    SYMBOLS[event.key] ??
    (/^[0-9]$/.test(event.key)
      ? `Digit${event.key}`
      : /^[a-z]$/i.test(event.key)
        ? `Key${event.key.toUpperCase()}`
        : event.code);
  const signature = (event) =>
    [event.ctrlKey && 'Ctrl', event.altKey && 'Alt', event.shiftKey && 'Shift', event.metaKey && 'Meta', codeOf(event)]
      .filter(Boolean)
      .join('+');
  const tell = (message) => parent.postMessage({ [CHANNEL]: message }, '*');
  addEventListener('message', (event) => {
    const message = event.source === parent && event.data && event.data[CHANNEL];
    if (!message) return;
    if (typeof message.zoom === 'number') document.documentElement.style.zoom = String(message.zoom);
    if (Array.isArray(message.keys)) wanted = message.keys;
  });
  addEventListener(
    'wheel',
    (event) => {
      if (!event.ctrlKey) return;
      if (!event.defaultPrevented) tell({ pinch: event.deltaY });
      event.preventDefault();
    },
    { passive: false },
  );
  addEventListener('gesturestart', (event) => event.preventDefault());
  addEventListener('keydown', (event) => {
    const keys = signature(event);
    if (!wanted.includes(keys)) return;
    event.preventDefault();
    tell({ keys });
  });
})();
