import { SvelteMap } from "svelte/reactivity";
import { isTouch } from "$lib/platform";
import { layout, MENU_GAP } from "$lib/platform/layout.svelte";
import { scrollbarWidth } from "./scrollbar";

export const CARD_DOCK = !isTouch;

interface DockAreaState {
  bar: number;
  shown: boolean;
  revision: number;
}

const areas = new SvelteMap<HTMLElement, DockAreaState>();

export function dockArea(node: HTMLElement, enabled = true) {
  if (!enabled) return;
  let state: DockAreaState = { bar: 0, shown: false, revision: 0 };
  const publish = (patch: Partial<DockAreaState>) => {
    state = { ...state, ...patch, revision: state.revision + 1 };
    areas.set(node, state);
  };
  const measure = () => {
    const bar = scrollbarWidth(node);
    if (bar !== state.bar) publish({ bar });
  };
  const sized = new ResizeObserver(() => publish({ bar: scrollbarWidth(node) }));
  sized.observe(node);
  const grown = new ResizeObserver(measure);
  for (const child of node.children) grown.observe(child);
  const added = new MutationObserver((records) => {
    for (const record of records) {
      for (const child of record.addedNodes) if (child instanceof Element) grown.observe(child);
    }
    measure();
  });
  added.observe(node, { childList: true });
  const sight = new IntersectionObserver(([entry]) => publish({ shown: entry.isIntersecting }), { threshold: [0, 1] });
  sight.observe(node);
  return {
    destroy: () => {
      sized.disconnect();
      grown.disconnect();
      added.disconnect();
      sight.disconnect();
      areas.delete(node);
    },
  };
}

class DockSpot {
  readonly #area = $derived.by(() => {
    const center = layout.width - layout.rightInset;
    let best: { box: DOMRect; bar: number } | null = null;
    for (const [node, area] of areas) {
      if (!area.shown || !node.isConnected || !node.checkVisibility({ visibilityProperty: true })) continue;
      const box = node.getBoundingClientRect();
      if (!box.width || !box.height || box.left >= center || box.right > center + 1) continue;
      if (!best || box.right > best.box.right || (box.right === best.box.right && box.bottom > best.box.bottom)) {
        best = { box, bar: area.bar };
      }
    }
    return best;
  });

  readonly anchored = $derived(this.#area !== null);

  readonly left = $derived(
    this.#area
      ? Math.max(this.#area.box.left, layout.safeLeft) + MENU_GAP
      : layout.menuPadding.left + layout.leftInset,
  );

  readonly right = $derived(
    this.#area
      ? Math.max(layout.width - this.#area.box.right + this.#area.bar, layout.safeRight) + MENU_GAP
      : layout.menuPadding.right + layout.rightInset,
  );

  readonly bottom = $derived(
    this.#area
      ? Math.max(layout.height - this.#area.box.bottom, layout.safeBottom + layout.keyboard) + MENU_GAP
      : layout.menuPadding.bottom + layout.bottomInset,
  );
}

export const dockSpot = new DockSpot();
