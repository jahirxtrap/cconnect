import { flushSync } from "svelte";
import { DEFAULT_PANE_BAR, PANE_VIEWS, type PaneView } from "$lib/app/screens";
import { settings } from "$lib/data/settings.svelte";
import { layout } from "$lib/platform/layout.svelte";
import { RowDrag, SPRING_MS, type RowOptions } from "$lib/ui/rowDrag.svelte";
import { StripDrag, type StripCross } from "$lib/ui/stripDrag.svelte";
import { panes, type RightKind } from "./panes.svelte";

export const PANE_BAR_GROUP = "pane-views";

const HALF = 2;

const VIEWS = new Map(PANE_VIEWS.map((view) => [view.kind, view]));

const kindOf = (id: string) => id as RightKind;

const known = (list: string[]) => [...new Set(list.map(kindOf))].filter((kind) => VIEWS.has(kind));

const viewsOf = (kinds: RightKind[]) => kinds.flatMap((kind) => VIEWS.get(kind) ?? []);

const placed = (list: RightKind[], kind: RightKind, index: number) => {
  const rest = list.filter((item) => item !== kind);
  rest.splice(Math.max(0, Math.min(index, rest.length)), 0, kind);
  return rest;
};

const without = (list: RightKind[], kind: RightKind) => list.filter((item) => item !== kind);

const inside = (element: HTMLElement | null, x: number, y: number) => {
  const box = element?.getBoundingClientRect();
  return !!box && x >= box.left && x <= box.right && y >= box.top && y <= box.bottom;
};

const before = (nodes: NodeListOf<HTMLElement> | undefined, at: (box: DOMRect) => boolean) =>
  [...(nodes ?? [])].filter((node) => at(node.getBoundingClientRect())).length;

class PaneViews {
  menuOpen = $state(false);
  overMenu = $state(false);

  #strip = $state<HTMLElement | null>(null);
  #trigger: HTMLElement | null = null;
  #list: HTMLElement | null = null;
  #spring: ReturnType<typeof setTimeout> | null = null;
  #sprung = false;

  readonly #order = $derived.by(() => {
    const custom = settings.paneBar.length > 0 || settings.paneMenu.length > 0;
    const bar = known(custom ? settings.paneBar : DEFAULT_PANE_BAR);
    const rest = known([...(custom ? settings.paneMenu : []), ...PANE_VIEWS.map((view) => view.kind)]);
    return { bar, menu: rest.filter((kind) => !bar.includes(kind)) };
  });

  readonly bar = $derived(viewsOf(this.#order.bar));

  readonly barDrag = new StripDrag(() => ({
    group: PANE_BAR_GROUP,
    strip: this.#strip,
    onMove: (id, index) => this.#save(placed(this.#order.bar, kindOf(id), index), this.#order.menu),
    onSelect: (id) => panes.setKind(kindOf(id)),
    onDrop: () => this.#dropBar(),
    onCross: (id, x, y) => this.#crossBar(kindOf(id), x, y),
  }));

  readonly menuDrag = new RowDrag();

  menuOf(all: boolean): PaneView[] {
    const kinds = all ? [...this.#order.bar, ...this.#order.menu] : this.#order.menu;
    return viewsOf(layout.mobile ? without(kinds, "chat") : kinds);
  }

  strip = (element: HTMLElement) => {
    this.#strip = element;
    return {
      destroy: () => {
        if (this.#strip === element) this.#strip = null;
      },
    };
  };

  trigger = (element: HTMLElement) => {
    this.#trigger = element;
    return {
      destroy: () => {
        if (this.#trigger === element) this.#trigger = null;
      },
    };
  };

  menuList = (element: HTMLElement) => {
    const list = element.parentElement;
    this.#list = list;
    return {
      destroy: () => {
        if (this.#list === list) this.#list = null;
      },
    };
  };

  beginMenuDrag(event: PointerEvent, kind: RightKind, index: number, all: boolean) {
    this.menuDrag.begin(event, kind, this.#rowOptions(index, all));
  }

  #save(bar: RightKind[], menu: RightKind[]) {
    settings.paneBar = bar;
    settings.paneMenu = menu;
  }

  #saveAll(kind: RightKind, index: number) {
    const shown = this.menuOf(true).map((view) => view.kind);
    const moved = placed(shown, kind, index);
    const order = [...this.#order.bar, ...this.#order.menu].map((item) =>
      shown.includes(item) ? (moved.shift() ?? item) : item,
    );
    this.#save(order.slice(0, this.#order.bar.length), order.slice(this.#order.bar.length));
  }

  #rowOptions(index: number, all = false): RowOptions {
    return {
      list: this.#list,
      manual: true,
      origin: { categoryId: null, index },
      onCommit: (id, target) => {
        if (target.index === null) return;
        if (all) this.#saveAll(kindOf(id), target.index);
        else this.#save(this.#order.bar, placed(this.#order.menu, kindOf(id), target.index));
      },
      onOutside: (id, event) => this.#leaveMenu(kindOf(id), event),
    };
  }

  #hover(over: boolean) {
    if (over === this.overMenu) return;
    this.overMenu = over;
    if (this.#spring !== null) clearTimeout(this.#spring);
    this.#spring = null;
    if (!over || this.menuOpen) return;
    this.#spring = setTimeout(() => {
      this.#spring = null;
      this.#sprung = true;
      this.menuOpen = true;
    }, SPRING_MS);
  }

  #crossBar(kind: RightKind, x: number, y: number): StripCross {
    if (!this.menuOpen || !inside(this.#list, x, y)) {
      this.#hover(inside(this.#trigger, x, y));
      return "stay";
    }
    const index = before(this.#list?.querySelectorAll<HTMLElement>("[data-row]"), (box) => box.top + box.height / HALF < y);
    this.#hover(false);
    this.#sprung = false;
    this.#save(without(this.#order.bar, kind), placed(this.#order.menu, kind, index));
    queueMicrotask(() => this.menuDrag.adopt(kind, x, y, false, this.#rowOptions(index)));
    return "left";
  }

  #dropBar() {
    const kind = kindOf(this.barDrag.held);
    const over = this.overMenu;
    this.#hover(false);
    if (over && kind) this.#save(without(this.#order.bar, kind), [...without(this.#order.menu, kind), kind]);
    if (!this.#sprung) return;
    this.#sprung = false;
    this.menuOpen = false;
  }

  #leaveMenu(kind: RightKind, event: PointerEvent) {
    if (!inside(this.#strip, event.clientX, event.clientY)) return false;
    const index = before(
      this.#strip?.querySelectorAll<HTMLElement>("[data-tab]"),
      (box) => box.left + box.width / HALF < event.clientX,
    );
    flushSync(() => {
      this.#save(placed(this.#order.bar, kind, index), without(this.#order.menu, kind));
      this.menuOpen = false;
    });
    this.barDrag.adopt(kind, event.pointerId, event.clientX);
    return true;
  }
}

export const paneViews = new PaneViews();
