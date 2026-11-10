export function onScreen(node: HTMLElement, report: (shown: boolean) => void) {
  const check = () => report(document.visibilityState === "visible" && !node.closest("[inert]"));
  const inert = new MutationObserver(check);
  inert.observe(document.body, { subtree: true, attributes: true, attributeFilter: ["inert"] });
  document.addEventListener("visibilitychange", check);
  check();
  return {
    destroy: () => {
      inert.disconnect();
      document.removeEventListener("visibilitychange", check);
    },
  };
}
