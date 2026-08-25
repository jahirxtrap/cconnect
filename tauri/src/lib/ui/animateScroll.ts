const DURATION_MS = 300;

const ease = (progress: number): number =>
  progress < 0.5 ? 4 * progress ** 3 : 1 - (-2 * progress + 2) ** 3 / 2;

export const animateScrollLeft = (element: HTMLElement, target: number): Promise<void> => {
  const start = element.scrollLeft;
  const distance = target - start;
  if (!distance) return Promise.resolve();
  const began = performance.now();
  const snap = element.style.scrollSnapType;
  element.style.scrollSnapType = "none";
  return new Promise((resolve) => {
    const step = (now: number) => {
      const progress = Math.min(1, (now - began) / DURATION_MS);
      element.scrollLeft = start + distance * ease(progress);
      if (progress < 1) {
        requestAnimationFrame(step);
        return;
      }
      element.style.scrollSnapType = snap;
      resolve();
    };
    requestAnimationFrame(step);
  });
};
