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
  const replacing = (event) => {
    const link = event.target instanceof Element && event.target.closest('a[href]');
    if (!link || event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    if ((link.target && link.target !== '_self') || link.hasAttribute('download')) return;
    if (new URL(link.href, location.href).origin !== location.origin) return;
    event.preventDefault();
    location.replace(link.href);
  };
  history.pushState = history.replaceState.bind(history);
  if (window.navigation) {
    navigation.addEventListener('navigate', (event) => {
      if (event.navigationType !== 'push' || !event.cancelable || event.formData || event.downloadRequest !== null) return;
      event.preventDefault();
      navigation.navigate(event.destination.url, { history: 'replace' });
    });
  } else {
    addEventListener('click', replacing);
  }
  tell({ shown: true });
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
