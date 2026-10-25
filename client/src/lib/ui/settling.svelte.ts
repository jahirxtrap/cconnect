export function settling<T>(read: () => T) {
  let settled = $state(read());

  $effect(() => {
    const value = read();
    if (value === settled) return;
    requestAnimationFrame(() => requestAnimationFrame(() => (settled = value)));
  });

  return {
    get active() {
      return read() !== settled;
    },
  };
}
