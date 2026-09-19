type WakeListener = (stale: boolean) => void;

const STALE_AWAY_MS = 45_000;
const COALESCE_MS = 1000;

const listeners = new Set<WakeListener>();

let hiddenAt = 0;
let lastWake = 0;
let installed = false;

const notify = () => {
  const now = Date.now();
  if (now - lastWake < COALESCE_MS) return;
  lastWake = now;
  const stale = !hiddenAt || now - hiddenAt >= STALE_AWAY_MS;
  hiddenAt = 0;
  for (const listener of [...listeners]) listener(stale);
};

const install = () => {
  if (installed) return;
  installed = true;
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") {
      hiddenAt = Date.now();
      return;
    }
    notify();
  });
  window.addEventListener("online", notify);
  (window as unknown as { __cconnectResume?: () => void }).__cconnectResume = notify;
};

export const onWake = (listener: WakeListener) => {
  install();
  listeners.add(listener);
  return () => void listeners.delete(listener);
};
