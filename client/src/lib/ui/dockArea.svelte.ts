import { SvelteMap } from "svelte/reactivity";
import { layout, MENU_GAP } from "$lib/platform/layout.svelte";
import { cssLength, PANE_GAP } from "./rem";
import { scrollbarWidth } from "./scrollbar";

interface DockAreaState {
  bar: number;
  shown: boolean;
  own: boolean;
  screen: boolean;
  revision: number;
}

const areas = new SvelteMap<HTMLElement, DockAreaState>();

export function dockArea(node: HTMLElement, options: boolean | { own?: boolean; screen?: boolean } = true) {
  if (!options) return;
  const own = typeof options !== "object" || options.own !== false;
  const screen = typeof options === "object" && options.screen === true;
  let state: DockAreaState = { bar: 0, shown: false, own, screen, revision: 0 };
  const publish = (patch: Partial<DockAreaState>) => {
    state = { ...state, ...patch, revision: state.revision + 1 };
    areas.set(node, state);
  };
  const sized = new ResizeObserver(() => publish({ bar: scrollbarWidth(node) }));
  sized.observe(node);
  const sight = new IntersectionObserver(([entry]) => publish({ shown: entry.isIntersecting }), { threshold: [0, 1] });
  sight.observe(node);
  return {
    destroy: () => {
      sized.disconnect();
      sight.disconnect();
      areas.delete(node);
    },
  };
}

class DockSpot {
  readonly #area = $derived.by(() => {
    const center = layout.width - layout.rightInset;
    let best: { box: DOMRect; bar: number; screen: boolean } | null = null;
    for (const [node, area] of areas) {
      if (!area.shown || !node.isConnected || !node.checkVisibility({ visibilityProperty: true })) continue;
      const box = node.getBoundingClientRect();
      if (!box.width || !box.height || box.left >= center || box.right > center + 1) continue;
      if (!best || box.right > best.box.right || (box.right === best.box.right && box.bottom > best.box.bottom)) {
        best = { box, bar: area.own ? area.bar : 0, screen: area.screen };
      }
    }
    return best;
  });

  readonly anchored = $derived(this.#area !== null);

  readonly left = $derived(this.#edge(this.#area ? this.#area.box.left : layout.leftInset));

  readonly right = $derived(
    this.#edge(this.#area ? layout.width - this.#area.box.right + this.#area.bar : layout.rightInset),
  );

  readonly bottom = $derived(
    this.#edge(
      this.#area && !this.#area.screen
        ? layout.height - this.#area.box.bottom
        : Math.max(layout.bottomInset, layout.safeBottom),
    ) + layout.keyboard,
  );

  #edge(distance: number): number {
    return Math.max(distance, layout.mobile ? 0 : cssLength(PANE_GAP)) + MENU_GAP;
  }
}

export const dockSpot = new DockSpot();
