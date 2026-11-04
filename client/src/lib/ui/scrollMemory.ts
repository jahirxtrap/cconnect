const positions = new Map<string, number>();
const RELEASES = ["wheel", "touchstart", "pointerdown", "keydown"];
const REACHED = 1;

export const rememberScroll = (node: HTMLElement, key: string) => {
  let pending = positions.get(key) ?? 0;
  const settle = () => {
    node.scrollTop = pending;
    if (node.scrollTop >= pending - REACHED) release();
  };
  const mutations = new MutationObserver(settle);
  const resizes = new ResizeObserver(settle);
  const release = () => {
    pending = 0;
    mutations.disconnect();
    resizes.disconnect();
    for (const name of RELEASES) node.removeEventListener(name, release);
  };
  const save = () => {
    if (!pending) positions.set(key, node.scrollTop);
  };
  node.addEventListener("scroll", save, { passive: true });
  if (pending) {
    for (const name of RELEASES) node.addEventListener(name, release, { passive: true });
    mutations.observe(node, { childList: true, subtree: true });
    resizes.observe(node);
    settle();
  } else {
    node.scrollTop = 0;
  }
  return () => {
    release();
    node.removeEventListener("scroll", save);
  };
};

export function scrollMemory(node: HTMLElement, key: string) {
  return { destroy: rememberScroll(node, key) };
}
