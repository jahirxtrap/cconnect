import type { DeviceBounds } from "./deviceBrowser.svelte";
import { browserCall } from "./deviceEngine";

const SAMPLE = 24;
const HANDLES = "[role=separator]";
const SEE_THROUGH = "browsing";
const CLEAR = "rgba(0, 0, 0, 0)";
const MASK = ["mask-image", "mask-size", "mask-position", "mask-repeat", "mask-composite"] as const;

const rounded = (box: DOMRect): DeviceBounds => ({
  x: Math.floor(box.left),
  y: Math.floor(box.top),
  width: Math.ceil(box.width),
  height: Math.ceil(box.height),
});

const layered = (hit: Element | null, surface: Element): hit is Element =>
  !!hit && hit !== surface && !surface.contains(hit) && hit !== document.documentElement && hit !== document.body;

const branchOf = (hit: Element, surface: Element): Element => {
  let node = hit;
  while (node.parentElement && !node.parentElement.contains(surface)) node = node.parentElement;
  return node;
};

export const coverOf = (surface: HTMLElement, hole: DeviceBounds): DeviceBounds[] => {
  const layers = new Set<Element>();
  for (let y = hole.y + SAMPLE / 2; y < hole.y + hole.height; y += SAMPLE) {
    for (let x = hole.x + SAMPLE / 2; x < hole.x + hole.width; x += SAMPLE) {
      const hit = document.elementFromPoint(x, y);
      if (layered(hit, surface)) layers.add(branchOf(hit, surface));
    }
  }
  for (const handle of document.querySelectorAll(HANDLES)) {
    const box = handle.getBoundingClientRect();
    const inside =
      box.left < hole.x + hole.width && box.right > hole.x && box.top < hole.y + hole.height && box.bottom > hole.y;
    if (inside) layers.add(handle);
  }
  return [...layers].map((layer) => rounded(layer.getBoundingClientRect()));
};

const roundedHole = (hole: DeviceBounds, radius: number) => {
  const shape = `<svg xmlns="http://www.w3.org/2000/svg" width="${hole.width}" height="${hole.height}"><rect width="100%" height="100%" rx="${radius}"/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(shape)}")`;
};

const painted = (node: HTMLElement) => {
  const style = getComputedStyle(node);
  return style.backgroundImage !== "none" || style.backgroundColor !== CLEAR;
};

export class BrowserLayer {
  #kept = new Map<HTMLElement, string[]>();
  #sent = "";
  #supported: boolean | null = null;

  get supported() {
    return this.#supported !== false;
  }

  show(surface: HTMLElement, hole: DeviceBounds | null, cover: DeviceBounds[]) {
    const radius = parseFloat(getComputedStyle(surface).borderTopLeftRadius) || 0;
    const sent = JSON.stringify([hole, radius, cover]);
    if (sent !== this.#sent) {
      this.#sent = sent;
      void browserCall<boolean>("browser_layer", { hole, radius, cover })
        .then((supported) => this.#answer(supported))
        .catch(() => this.#answer(false));
    }
    if (this.#supported === false) return;
    document.documentElement.classList.toggle(SEE_THROUGH, !!hole);
    const chain: HTMLElement[] = [];
    for (let node: HTMLElement | null = hole ? surface : null; node && node !== document.body; node = node.parentElement) {
      if (painted(node) || this.#kept.has(node)) chain.push(node);
    }
    for (const node of [...this.#kept.keys()]) {
      if (!chain.includes(node)) this.#restore(node);
    }
    if (!hole) return;
    const opening = roundedHole(hole, radius);
    for (const node of chain) {
      if (!this.#kept.has(node)) this.#kept.set(node, MASK.map((name) => node.style.getPropertyValue(name)));
      const box = node.getBoundingClientRect();
      node.style.setProperty("mask-image", `linear-gradient(#000 0 0), ${opening}`);
      node.style.setProperty("mask-size", `100% 100%, ${hole.width}px ${hole.height}px`);
      node.style.setProperty("mask-position", `0 0, ${hole.x - box.left}px ${hole.y - box.top}px`);
      node.style.setProperty("mask-repeat", "no-repeat");
      node.style.setProperty("mask-composite", "exclude");
    }
  }

  clear() {
    this.#uncover();
    this.#sent = JSON.stringify([null, 0, []]);
    void browserCall("browser_layer", { hole: null, radius: 0, cover: [] }).catch(() => undefined);
  }

  #answer(supported: boolean) {
    this.#supported = supported;
    if (!supported) this.#uncover();
  }

  #uncover() {
    document.documentElement.classList.remove(SEE_THROUGH);
    for (const node of [...this.#kept.keys()]) this.#restore(node);
  }

  #restore(node: HTMLElement) {
    const kept = this.#kept.get(node) ?? [];
    MASK.forEach((name, index) => {
      if (kept[index]) node.style.setProperty(name, kept[index]);
      else node.style.removeProperty(name);
    });
    this.#kept.delete(node);
  }
}
