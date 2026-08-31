<script lang="ts">
  import ArrowDown from "@lucide/svelte/icons/arrow-down";
  import ArrowUp from "@lucide/svelte/icons/arrow-up";
  import Check from "@lucide/svelte/icons/check";
  import ChevronDown from "@lucide/svelte/icons/chevron-down";
  import ChevronUp from "@lucide/svelte/icons/chevron-up";
  import X from "@lucide/svelte/icons/x";
  import { transfers } from "$lib/data/transfers.svelte";
  import { t } from "$lib/i18n/index.svelte";
  import { layout } from "$lib/platform/layout.svelte";
  import ProgressRing from "./ProgressRing.svelte";
  import { borderWidth, scrollableUnder, scrollbarWidth } from "./scrollbar";
  import TooltipIconButton from "./TooltipIconButton.svelte";

  const HALF = 2;

  const items = $derived(transfers.items);
  const done = $derived(transfers.finished.length);
  const running = $derived(transfers.active.length);

  let panelHeight = $state(0);
  let scrollbar = $state(0);

  $effect(() => {
    layout.transfersInset = items.length ? panelHeight + layout.menuPadding.bottom + layout.bottomInset : 0;
    return () => (layout.transfersInset = 0);
  });

  $effect(() => {
    void [layout.width, layout.height];
    if (!items.length) return;
    let tracked: HTMLElement | null = null;
    let border = 0;
    let frame = 0;
    const measure = () => {
      if (!tracked?.isConnected) {
        tracked = scrollableUnder(layout.width - layout.safeRight - 1, layout.height / HALF);
        border = tracked ? borderWidth(tracked) : 0;
      }
      scrollbar = tracked ? scrollbarWidth(tracked, border) : 0;
      frame = requestAnimationFrame(measure);
    };
    measure();
    return () => cancelAnimationFrame(frame);
  });
</script>

{#if items.length}
  <div
    style="padding: {layout.menuPadding.top}px {layout.menuPadding.right + scrollbar}px {layout.menuPadding
      .bottom}px {layout.menuPadding.left}px"
    class="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-end"
  >
    <div
      bind:clientHeight={panelHeight}
      style="margin-bottom: {layout.bottomInset}px"
      class="menu-surface pointer-events-auto w-full overflow-hidden rounded-lg border border-outline-variant bg-surface-variant shadow-lg sm:w-90"
    >
      <div class="flex items-center gap-1 py-1 pr-1 pl-3.5">
        <p class="min-w-0 flex-1 truncate text-label-lg font-bold text-on-surface-variant">
          {running ? t("TRANSFERS_ACTIVE", `${done + 1}`, `${items.length}`) : t("TRANSFERS_DONE")}
        </p>
        <TooltipIconButton
          label={transfers.collapsed ? t("EXPAND") : t("COLLAPSE")}
          tooltip={false}
          class="size-8"
          onclick={() => (transfers.collapsed = !transfers.collapsed)}
        >
          {#if transfers.collapsed}
            <ChevronUp />
          {:else}
            <ChevronDown />
          {/if}
        </TooltipIconButton>
        <TooltipIconButton label={t("CLOSE")} tooltip={false} class="size-8" onclick={() => transfers.dismiss()}>
          <X />
        </TooltipIconButton>
      </div>

      {#if !transfers.collapsed}
        <div class="scrollbar-thin max-h-64 overflow-y-auto border-t border-outline-variant py-1">
          {#each items as item (item.id)}
            <div class="flex items-center gap-2.5 px-3.5 py-1.5">
              {#if item.kind === "upload"}
                <ArrowUp size={16} class="shrink-0 text-on-surface-variant" />
              {:else}
                <ArrowDown size={16} class="shrink-0 text-on-surface-variant" />
              {/if}
              <span
                class="min-w-0 flex-1 truncate text-body-md {item.status === 'done' ? 'text-on-surface-variant' : ''}"
              >
                {item.name}
              </span>
              {#if item.status === "active"}
                <ProgressRing value={item.progress} size={20} stroke={2.5} />
                <button
                  type="button"
                  onclick={() => transfers.cancel(item.id)}
                  aria-label={t("CANCEL")}
                  class="cursor-pointer text-on-surface-variant transition-colors hover:text-on-surface"
                >
                  <X size={18} />
                </button>
              {:else if item.status === "done"}
                <Check size={18} class="text-accent" />
              {:else}
                <X size={18} class="text-red" />
              {/if}
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </div>
{/if}
