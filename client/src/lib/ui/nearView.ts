const MARGIN = "100%";

const arrivals = new WeakMap<Element, () => void>();

let observer: IntersectionObserver | null = null;

const shared = () =>
  (observer ??= new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const arrive = arrivals.get(entry.target);
        arrivals.delete(entry.target);
        observer?.unobserve(entry.target);
        arrive?.();
      }
    },
    { rootMargin: MARGIN, scrollMargin: MARGIN },
  ));

export function nearView(node: Element, arrive: () => void) {
  arrivals.set(node, arrive);
  shared().observe(node);
  return {
    destroy() {
      arrivals.delete(node);
      observer?.unobserve(node);
    },
  };
}
