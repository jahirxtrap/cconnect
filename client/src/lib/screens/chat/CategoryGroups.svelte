<script lang="ts" generics="T">
  import ChevronDown from "@lucide/svelte/icons/chevron-down";
  import ChevronRight from "@lucide/svelte/icons/chevron-right";
  import Plus from "@lucide/svelte/icons/plus";
  import type { Snippet } from "svelte";
  import { sessionColorOf } from "$lib/design/sessionColors";
  import type { ChatCategory, ChatPlacement } from "$lib/data/models";
  import { t } from "$lib/i18n/index.svelte";
  import { RowDrag } from "$lib/ui/rowDrag.svelte";
  import { LIST_VIEWPORT_CLASS, viewportScrollbar } from "$lib/ui/scrollbar";
  import { CategoryDrag } from "./dragCategories.svelte";
  import type { ChatState } from "./state.svelte";

  interface Props {
    chat: ChatState;
    items: T[];
    keyOf: (item: T) => string;
    recency: (item: T) => number;
    placementOf: (item: T) => ChatPlacement | undefined;
    categories: ChatCategory[];
    searching: boolean;
    scrollKey?: unknown;
    onMove: (key: string, categoryId: string | null, index: number | null, order: string[]) => void;
    onNewIn: (categoryId: string) => void;
    row: Snippet<[T]>;
    fallback: Snippet;
  }

  const {
    chat,
    items,
    keyOf,
    recency,
    placementOf,
    categories,
    searching,
    scrollKey,
    onMove,
    onNewIn,
    row,
    fallback,
  }: Props = $props();

  interface Group {
    category: ChatCategory | null;
    items: T[];
  }

  const groups = $derived.by((): Group[] => {
    const ordered = (list: T[]) =>
      chat.chatOrder === "manual"
        ? [...list].sort(
            (a, b) => (placementOf(a)?.position ?? Number.MAX_VALUE) - (placementOf(b)?.position ?? Number.MAX_VALUE),
          )
        : [...list].sort((a, b) => recency(b) - recency(a));
    if (!categories.length) return [{ category: null, items: ordered(items) }];
    const shown = new Set(categories.map((category) => category.id));
    const groupOf = (item: T) => {
      const placed = placementOf(item)?.categoryId ?? null;
      return placed !== null && shown.has(placed) ? placed : null;
    };
    const inCategory = (id: string | null) => ordered(items.filter((item) => groupOf(item) === id));
    const result: Group[] = categories
      .filter((category) => !chat.isCategoryHidden(category.id))
      .map((category) => ({ category, items: inCategory(category.id) }));
    const loose = inCategory(null);
    return loose.length ? [...result, { category: null, items: loose }] : result;
  });

  const shownGroups = $derived<Group[]>(searching ? [{ category: null, items }] : groups);

  let list = $state<HTMLDivElement | null>(null);
  const drag = new RowDrag();
  const categoryDrag = new CategoryDrag();
  let settling = $state(false);

  const startCategoryDrag = (event: PointerEvent, categoryId: string) =>
    categoryDrag.begin(event, categoryId, {
      list,
      onCommit: (moved, beforeId) => {
        const rest = chat.categories.filter((item) => item.id !== moved);
        const at = beforeId === null ? rest.length : rest.findIndex((item) => item.id === beforeId);
        const index = at < 0 ? rest.length : at;
        if (chat.categories.findIndex((item) => item.id === moved) === index) return;
        settling = true;
        chat.reorderCategory(moved, index);
        void chat.commitCategoryOrder(moved);
        requestAnimationFrame(() => requestAnimationFrame(() => (settling = false)));
      },
    });

  const startDrag = (event: PointerEvent, item: T, index: number) =>
    drag.begin(event, keyOf(item), {
      list,
      manual: chat.chatOrder === "manual",
      origin: { categoryId: placementOf(item)?.categoryId ?? null, index },
      onExpand: (categoryId) => {
        const category = chat.categories.find((entry) => entry.id === categoryId);
        if (category && chat.isCategoryCollapsed(categoryId)) chat.toggleCategory(category);
      },
      onCommit: (key, target) => {
        const destination = groups.find((group) => (group.category?.id ?? null) === target.categoryId);
        onMove(key, target.categoryId, target.index, (destination?.items ?? []).map(keyOf));
      },
    });

  $effect(() => {
    void scrollKey;
    if (list) list.scrollTop = 0;
  });
</script>

<div
  bind:this={list}
  use:viewportScrollbar
  class="scrollbar-thin flex min-h-0 flex-1 flex-col gap-px overflow-y-auto {LIST_VIEWPORT_CLASS} {drag.active
    ? 'cursor-pointer'
    : ''}"
>
  {#if items.length}
    {#each shownGroups as group, groupIndex (group.category?.id ?? "loose")}
      {#if !group.category && groupIndex > 0}
        <div data-spacer={groupIndex} class="my-1 shrink-0">
          <div
            class="mx-2 border-t border-outline-variant"
            style="transform: translateY({drag.shiftFor(`spacer:${groupIndex}`)}px); transition: {drag.active
              ? 'transform 160ms cubic-bezier(0.2, 0, 0, 1)'
              : 'none'}"
          ></div>
        </div>
      {/if}
      {#if group.category}
        {@const category = group.category}
        {@const collapsed = chat.isCategoryCollapsed(category.id)}
        {@const held = categoryDrag.dragging(category.id)}
        {@const joined = held && !collapsed && group.items.length > 0}
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
          data-header={category.id}
          data-collapsed={collapsed}
          class="relative {held ? 'z-10' : ''} {drag.active || categoryDrag.active ? 'pointer-events-none' : ''}"
          onpointerdown={(event) => startCategoryDrag(event, category.id)}
        >
          <div
            data-press
            class="flex h-7 w-full items-center pr-1.5 pl-2.5 transition-colors {joined
              ? 'rounded-t-item'
              : 'rounded-item'} {drag.highlights(category.id)
              ? 'bg-accent-soft outline-2 -outline-offset-2 outline-accent'
              : held
                ? 'bg-hover'
                : 'hover:bg-hover'}"
            style="transform: translateY({held
              ? categoryDrag.offset
              : drag.shiftFor(`cat:${category.id}`) + categoryDrag.shiftFor(category.id)}px); transition: {held ||
            settling ||
            (!drag.active && !categoryDrag.active)
              ? 'none'
              : 'transform 160ms cubic-bezier(0.2, 0, 0, 1)'}"
          >
          <button
            type="button"
            class="flex h-full min-w-0 flex-1 cursor-pointer items-center gap-2 text-left"
            onclick={() => chat.toggleCategory(category)}
          >
            <span class="flex size-4 shrink-0 items-center justify-center text-on-surface-variant">
              {#if collapsed}
                <ChevronRight size={14} />
              {:else}
                <ChevronDown size={14} />
              {/if}
            </span>
            <span
              class="min-w-0 flex-1 truncate text-label-md"
              style={`color: ${sessionColorOf(category.color) ?? "var(--c-on-surface-variant)"}`}
            >
              {category.name}
            </span>
            <span class="flex size-6 shrink-0 items-center justify-center text-caption text-faint">
              {group.items.length}
            </span>
          </button>
          <button
            type="button"
            aria-label={t("NEW_CHAT")}
            class="flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-hover hover:text-on-surface"
            onpointerdown={(event) => event.stopPropagation()}
            onclick={() => onNewIn(category.id)}
          >
            <Plus size={14} />
          </button>
          </div>
        </div>
      {/if}
      {#if !group.category || !chat.isCategoryCollapsed(group.category.id)}
        {@const groupId = group.category?.id ?? null}
        {#each group.items as item, index (keyOf(item))}
          {@const dragged = drag.id === keyOf(item)}
          {@const carried = categoryDrag.dragging(groupId)}
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div
            data-row={keyOf(item)}
            data-group={groupId ?? ""}
            data-index={index}
            class="relative {dragged || carried ? 'z-10' : ''} {drag.active || categoryDrag.active
              ? 'pointer-events-none'
              : ''}"
            onpointerdown={(event) => !searching && startDrag(event, item, index)}
          >
          <div
            class={dragged
              ? "rounded-item bg-hover"
              : carried
                ? `bg-hover ${index === group.items.length - 1 ? "rounded-b-item" : ""}`
                : ""}
            style="transform: translateY({dragged
              ? drag.offset
              : carried
                ? categoryDrag.offset
                : drag.shiftFor(keyOf(item)) + categoryDrag.shiftFor(groupId)}px); transition: {dragged ||
            carried ||
            settling ||
            (!drag.active && !categoryDrag.active)
              ? 'none'
              : 'transform 160ms cubic-bezier(0.2, 0, 0, 1)'}"
          >
            {@render row(item)}
          </div>
          </div>
        {/each}
      {/if}
    {/each}
  {:else}
    {@render fallback()}
  {/if}
</div>
