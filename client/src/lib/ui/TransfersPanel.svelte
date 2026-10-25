<script lang="ts">
  import ArrowDown from "@lucide/svelte/icons/arrow-down";
  import ArrowUp from "@lucide/svelte/icons/arrow-up";
  import Check from "@lucide/svelte/icons/check";
  import ChevronDown from "@lucide/svelte/icons/chevron-down";
  import ChevronUp from "@lucide/svelte/icons/chevron-up";
  import X from "@lucide/svelte/icons/x";
  import { transfers } from "$lib/data/transfers.svelte";
  import { t } from "$lib/i18n/index.svelte";
  import { isDesktop } from "$lib/platform";
  import { layout } from "$lib/platform/layout.svelte";
  import { dragSaved, openTransfer } from "$lib/services/sharedFiles";
  import FloatDock from "./FloatDock.svelte";
  import { FLOAT_HEAD_CLASS, FLOAT_PANEL_WIDTH, FLOAT_SURFACE_CLASS, MENU_SCROLL_CLASS } from "./menuSurface";
  import ProgressRing from "./ProgressRing.svelte";
  import { viewportScrollbar } from "./scrollbar";
  import TooltipIconButton from "./TooltipIconButton.svelte";

  const items = $derived(transfers.items);
  const done = $derived(transfers.finished.length);
  const running = $derived(transfers.active.length);

  let panelHeight = $state(0);

  $effect(() => {
    layout.transfersInset = items.length ? panelHeight + layout.menuPadding.bottom + layout.bottomInset : 0;
    return () => (layout.transfersInset = 0);
  });
</script>

{#if items.length}
  <FloatDock>
    <div
      bind:clientHeight={panelHeight}
      class="menu-surface pointer-events-auto overflow-hidden {FLOAT_PANEL_WIDTH} {FLOAT_SURFACE_CLASS}"
    >
      <div class={FLOAT_HEAD_CLASS}>
        <p class="min-w-0 flex-1 truncate text-label-lg text-on-surface-variant">
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
        <div role="list" class="max-h-64 {MENU_SCROLL_CLASS}" use:viewportScrollbar>
          {#each items as item (item.id)}
            {@const openable = item.status === "done" && item.url.length > 0}
            {@const dragging = isDesktop && item.status === "done" && item.saved.length > 0}
            <div
              role="listitem"
              data-press={openable ? "" : "off"}
              draggable={dragging}
              ondragstart={(event) => {
                if (!dragging) return;
                event.preventDefault();
                void dragSaved(item.saved);
              }}
              class="flex items-center gap-2.5 rounded-item px-2.5 py-1.5 transition-colors {openable
                ? 'hover:bg-hover'
                : ''}"
            >
              {#if item.kind === "upload"}
                <ArrowUp size={16} class="shrink-0 text-on-surface-variant" />
              {:else}
                <ArrowDown size={16} class="shrink-0 text-on-surface-variant" />
              {/if}
              <button
                type="button"
                disabled={!openable}
                onclick={() => void openTransfer(item.saved, item.url, item.name)}
                class="block min-w-0 flex-1 truncate text-left text-body-md {item.status === 'done'
                  ? 'text-on-surface-variant'
                  : ''} {openable ? 'cursor-pointer' : 'cursor-default'}"
              >
                {item.name}
              </button>
              {#if item.status === "active"}
                <ProgressRing value={item.progress} size={16} stroke={2} />
                <button
                  type="button"
                  data-press="off"
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
  </FloatDock>
{/if}
