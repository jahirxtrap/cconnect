<script lang="ts">
  import ArrowDown from "@lucide/svelte/icons/arrow-down";
  import ArrowUp from "@lucide/svelte/icons/arrow-up";
  import Check from "@lucide/svelte/icons/check";
  import ChevronDown from "@lucide/svelte/icons/chevron-down";
  import X from "@lucide/svelte/icons/x";
  import { untrack } from "svelte";
  import { openFilePreview } from "$lib/app/filePreview";
  import { transfers, type Transfer } from "$lib/data/transfers.svelte";
  import { t } from "$lib/i18n/index.svelte";
  import { isDesktop, isTauri } from "$lib/platform";
  import { layout } from "$lib/platform/layout.svelte";
  import { dragSaved, openTransfer } from "$lib/services/sharedFiles";
  import ConfirmDialog from "./ConfirmDialog.svelte";
  import { dockSpot } from "./dockArea.svelte";
  import FloatDock from "./FloatDock.svelte";
  import { FLOAT_HEAD_CLASS, FLOAT_PANEL_WIDTH, FLOAT_SURFACE_CLASS, MENU_SCROLL_CLASS } from "./menuSurface";
  import { PANEL_EASING, TOGGLE_MS } from "./motion";
  import ProgressRing from "./ProgressRing.svelte";
  import { viewportScrollbar } from "./scrollbar";
  import TooltipIconButton from "./TooltipIconButton.svelte";

  interface Box {
    width: number;
    height: number;
    radius: number;
  }

  const items = $derived(transfers.items);
  const done = $derived(transfers.finished.length);
  const running = $derived(transfers.active.length);
  const count = $derived(`${running ? done + 1 : items.length}/${items.length}`);

  let panelHeight = $state(0);
  let closing = $state(false);
  let surface = $state<HTMLDivElement | null>(null);
  let from: Box | null = null;

  const open = (item: Transfer) => {
    if (isTauri) void openTransfer(item.saved, item.url, item.name);
    else openFilePreview({ url: item.url, name: item.name, onDelete: null });
  };

  const close = () => {
    if (running) closing = true;
    else transfers.dismiss();
  };

  const boxOf = (node: HTMLElement): Box => {
    const rect = node.getBoundingClientRect();
    const radius = parseFloat(getComputedStyle(node).borderTopLeftRadius) || 0;
    return { width: rect.width, height: rect.height, radius: Math.min(radius, rect.height / 2) };
  };

  const frame = (box: Box) => ({ width: `${box.width}px`, height: `${box.height}px`, borderRadius: `${box.radius}px` });

  $effect.pre(() => {
    void transfers.collapsed;
    const node = untrack(() => surface);
    from = node ? boxOf(node) : null;
  });

  $effect(() => {
    void transfers.collapsed;
    const node = untrack(() => surface);
    const start = from;
    from = null;
    if (!node || !start) return;
    node.animate([frame(start), frame(boxOf(node))], { duration: TOGGLE_MS, easing: PANEL_EASING });
  });

  $effect(() => {
    layout.transfersInset = items.length ? panelHeight + dockSpot.bottom : 0;
    return () => (layout.transfersInset = 0);
  });
</script>

{#if items.length}
  <FloatDock>
    <div
      bind:this={surface}
      bind:clientHeight={panelHeight}
      class="menu-surface pointer-events-auto overflow-hidden {transfers.collapsed
        ? 'rounded-full bg-float shadow-float'
        : `${FLOAT_PANEL_WIDTH} ${FLOAT_SURFACE_CLASS}`}"
    >
      {#if transfers.collapsed}
        <div class="relative flex h-8 items-center gap-2 pr-1 pl-2">
          <button
            type="button"
            onclick={() => (transfers.collapsed = false)}
            aria-label={t("EXPAND")}
            class="absolute inset-0 cursor-pointer transition-colors hover:bg-hover"
          ></button>
          <span class="pointer-events-none relative flex items-center gap-2 text-on-surface-variant">
            {#if running}
              <ProgressRing value={transfers.progress} size={16} stroke={2} />
            {:else}
              <Check size={16} class="shrink-0 text-accent" />
            {/if}
            <span class="text-label-lg">{count}</span>
          </span>
          <button
            type="button"
            onclick={close}
            aria-label={t("CLOSE")}
            class="relative -ml-1 inline-flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-hover hover:text-on-surface"
          >
            <X size={16} />
          </button>
        </div>
      {:else}
        <div class={FLOAT_HEAD_CLASS}>
          <p class="min-w-0 flex-1 truncate pr-1 text-label-lg text-on-surface-variant">
            {running ? t("TRANSFERS_ACTIVE", `${done + 1}`, `${items.length}`) : t("TRANSFERS_DONE")}
          </p>
          <TooltipIconButton
            label={t("COLLAPSE")}
            tooltip={false}
            class="size-8"
            onclick={() => (transfers.collapsed = true)}
          >
            <ChevronDown />
          </TooltipIconButton>
          <TooltipIconButton label={t("CLOSE")} tooltip={false} class="size-8" onclick={close}>
            <X />
          </TooltipIconButton>
        </div>

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
                onclick={() => open(item)}
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

{#if closing}
  <ConfirmDialog
    title={t("CLOSE")}
    text={t("TRANSFERS_CLOSE_CONFIRM")}
    confirmLabel={t("CLOSE")}
    danger
    onConfirm={() => {
      closing = false;
      transfers.dismiss();
    }}
    onDismiss={() => (closing = false)}
  />
{/if}
