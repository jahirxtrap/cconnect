import { ListDrag } from "$lib/ui/listDrag.svelte";

interface Block {
  categoryId: string;
  top: number;
  bottom: number;
}

interface Drop {
  beforeId: string | null;
  at: number;
  y: number;
}

interface CategoryOptions {
  list: HTMLElement | null;
  onCommit: (categoryId: string, beforeId: string | null) => void;
}

export class CategoryDrag extends ListDrag<Block, Drop> {
  #before: string | null = null;
  #commit: ((categoryId: string, beforeId: string | null) => void) | null = null;

  shiftFor(categoryId: string | null): number {
    return this.shiftOf(categoryId);
  }

  dragging(categoryId: string | null): boolean {
    return this.active && categoryId === this.dragged;
  }

  begin(event: PointerEvent, categoryId: string, options: CategoryOptions) {
    this.#commit = options.onCommit;
    this.press(event, categoryId, options.list);
  }

  protected measure(list: HTMLElement): Block[] {
    const nodes = Array.from(list.querySelectorAll<HTMLElement>("[data-header], [data-row]"));
    const blocks: Block[] = [];
    let current: Block | null = null;
    for (const node of nodes) {
      const box = node.getBoundingClientRect();
      if (node.dataset.header !== undefined) {
        current = { categoryId: node.dataset.header ?? "", top: box.top, bottom: box.bottom };
        blocks.push(current);
        continue;
      }
      const group = node.dataset.group || null;
      if (current && group === current.categoryId) current.bottom = box.bottom;
      else current = null;
    }
    return blocks;
  }

  protected keyOf(block: Block): string {
    return block.categoryId;
  }

  protected started() {
    this.#before = null;
  }

  protected landings(): Drop[] {
    const drops: Drop[] = this.spans.map((block, at) => ({ beforeId: block.categoryId, at, y: block.top }));
    const last = this.spans[this.spans.length - 1];
    if (last) drops.push({ beforeId: null, at: this.spans.length, y: last.bottom });
    return drops;
  }

  protected land(drop: Drop) {
    this.#before = drop.beforeId;
  }

  protected settle(categoryId: string): (() => void) | null {
    const before = this.#before;
    const commit = this.#commit;
    return before === categoryId ? null : () => commit?.(categoryId, before);
  }

  protected cleared() {
    this.#before = null;
  }
}
