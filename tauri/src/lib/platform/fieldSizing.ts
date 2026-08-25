const NATIVE = typeof CSS !== "undefined" && (CSS.supports?.("field-sizing", "content") ?? false);

const SELECTOR = "textarea.field-auto";

const fit = (node: HTMLTextAreaElement) => {
  if (!node.isConnected) return;
  node.style.height = "auto";
  node.style.height = `${node.scrollHeight}px`;
};

const fitAll = (root: ParentNode) => {
  for (const node of root.querySelectorAll<HTMLTextAreaElement>(SELECTOR)) fit(node);
};

export function polyfillFieldSizing() {
  if (NATIVE) return;
  document.addEventListener(
    "input",
    (event) => {
      const target = event.target;
      if (target instanceof HTMLTextAreaElement && target.matches(SELECTOR)) fit(target);
    },
    true,
  );

  const descriptor = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value");
  if (descriptor?.get && descriptor.set) {
    const { get, set } = descriptor;
    Object.defineProperty(HTMLTextAreaElement.prototype, "value", {
      configurable: true,
      enumerable: descriptor.enumerable,
      get,
      set(this: HTMLTextAreaElement, value: string) {
        set.call(this, value);
        if (this.matches(SELECTOR)) fit(this);
      },
    });
  }

  new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (!(node instanceof HTMLElement)) continue;
        if (node.matches(SELECTOR)) fit(node as HTMLTextAreaElement);
        else fitAll(node);
      }
    }
  }).observe(document.documentElement, { childList: true, subtree: true });

  fitAll(document);
}
