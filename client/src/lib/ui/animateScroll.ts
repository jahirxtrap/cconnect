const DURATION_MS = 300;
const TAKEOVERS = ["pointerdown", "touchstart", "wheel"] as const;

const ease = (progress: number): number =>
  progress < 0.5 ? 4 * progress ** 3 : 1 - (-2 * progress + 2) ** 3 / 2;

const running = new WeakMap<HTMLElement, (superseded: boolean) => void>();

export const animateScrollLeft = (element: HTMLElement, target: number): Promise<boolean> => {
  running.get(element)?.(true);
  const start = element.scrollLeft;
  const distance = target - start;
  if (!distance) return Promise.resolve(true);
  const began = performance.now();
  const snap = element.style.scrollSnapType;
  element.style.scrollSnapType = "none";
  return new Promise((resolve) => {
    let frame = 0;
    const finish = (superseded: boolean) => {
      cancelAnimationFrame(frame);
      running.delete(element);
      for (const kind of TAKEOVERS) element.removeEventListener(kind, takeover);
      element.style.scrollSnapType = snap;
      resolve(!superseded);
    };
    const takeover = () => finish(false);
    const step = (now: number) => {
      const progress = Math.min(1, (now - began) / DURATION_MS);
      element.scrollLeft = start + distance * ease(progress);
      if (progress < 1) frame = requestAnimationFrame(step);
      else finish(false);
    };
    running.set(element, finish);
    for (const kind of TAKEOVERS) element.addEventListener(kind, takeover, { passive: true });
    frame = requestAnimationFrame(step);
  });
};
