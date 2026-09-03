const NATIVE = typeof CSS !== "undefined" && (CSS.supports?.("field-sizing", "content") ?? false);

const SELECTOR = "textarea.field-auto";

const MIRRORED = [
  "boxSizing", "width", "paddingTop", "paddingRight", "paddingBottom", "paddingLeft",
  "borderTopWidth", "borderRightWidth", "borderBottomWidth", "borderLeftWidth",
  "fontFamily", "fontSize", "fontWeight", "fontStyle", "letterSpacing", "lineHeight",
  "textTransform", "textIndent", "whiteSpace", "wordSpacing", "overflowWrap", "tabSize",
] as const;

const caretTop = (node: HTMLTextAreaElement): number => {
  const style = getComputedStyle(node);
  const mirror = document.createElement("div");
  for (const property of MIRRORED) mirror.style[property] = style[property];
  mirror.style.cssText += ";position:absolute;visibility:hidden;top:0;left:-9999px;height:auto;white-space:pre-wrap";
  const marker = document.createElement("span");
  mirror.textContent = node.value.slice(0, node.selectionEnd ?? 0);
  marker.textContent = node.value.slice(node.selectionEnd ?? 0) || ".";
  mirror.appendChild(marker);
  document.body.appendChild(mirror);
  const top = marker.offsetTop;
  mirror.remove();
  return top;
};

export const keepCaretInView = (node: HTMLTextAreaElement) => {
  if (node.scrollHeight <= node.clientHeight) return;
  const line = parseFloat(getComputedStyle(node).lineHeight) || 20;
  const top = caretTop(node);
  if (top < node.scrollTop) node.scrollTop = top;
  else if (top + line > node.scrollTop + node.clientHeight) node.scrollTop = top + line - node.clientHeight;
};

const fit = (node: HTMLTextAreaElement) => {
  if (!node.isConnected || node.clientWidth === 0) return;
  node.style.height = "auto";
  node.style.height = `${node.scrollHeight}px`;
};

const widths = new ResizeObserver((entries) => {
  for (const entry of entries) fit(entry.target as HTMLTextAreaElement);
});

const watch = (node: HTMLTextAreaElement) => {
  widths.observe(node);
  fit(node);
};

const fitAll = (root: ParentNode) => {
  for (const node of root.querySelectorAll<HTMLTextAreaElement>(SELECTOR)) watch(node);
};

export function polyfillFieldSizing() {
  const track = (event: Event) => {
    const target = event.target;
    if (target instanceof HTMLTextAreaElement) requestAnimationFrame(() => keepCaretInView(target));
  };
  document.addEventListener("input", track, true);
  document.addEventListener("keyup", track, true);
  document.addEventListener("click", track, true);

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
        if (node.matches(SELECTOR)) watch(node as HTMLTextAreaElement);
        else fitAll(node);
      }
    }
  }).observe(document.documentElement, { childList: true, subtree: true });

  fitAll(document);
}
