<script lang="ts">
  import X from "@lucide/svelte/icons/x";
  import { t } from "$lib/i18n/index.svelte";
  import { layout } from "$lib/platform/layout.svelte";
  import { hscrollbar, SCROLL_ROW_CLASS } from "$lib/ui/scrollbar";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";
  import { PANE_HEADER_CLASS, paneDim } from "./paneChrome";
  import { panes } from "./panes.svelte";
  import { PANE_BAR_GROUP, paneViews } from "./paneViews.svelte";
  import PaneViewMenu from "./PaneViewMenu.svelte";

  interface Props {
    tools?: boolean;
  }

  const { tools = true }: Props = $props();

  const drag = paneViews.barDrag;
  const dimmed = $derived(panes.split && panes.focused !== "right");
  const held = $derived(drag.held);

  $effect(() => {
    const kind = panes.kind;
    if (tools && paneViews.bar.some((view) => view.kind === kind)) drag.reveal(kind);
  });
</script>

{#snippet actions()}
  <PaneViewMenu all={!tools} />
  {#if layout.mobile}
    <TooltipIconButton label={t("CLOSE")} shortcut="panel.right" onclick={() => panes.setOpen(false)}>
      <X />
    </TooltipIconButton>
  {/if}
{/snippet}

{#if tools}
  <div class="{PANE_HEADER_CLASS} {paneDim(dimmed)}">
    <div
      use:paneViews.strip
      use:hscrollbar={{ wheel: true }}
      role="tablist"
      data-strip={PANE_BAR_GROUP}
      class="{SCROLL_ROW_CLASS} flex min-w-0 flex-1 items-center gap-0.5"
    >
      {#each paneViews.bar as view (view.kind)}
        {@const active = panes.kind === view.kind}
        {@const dragging = view.kind === held}
        <div
          use:drag.register={view.kind}
          data-tab={view.kind}
          role="tab"
          tabindex={active ? 0 : -1}
          aria-selected={active}
          onpointerdown={(event) => drag.onPointerDown(event, view.kind)}
          onkeydown={(event) => event.key === "Enter" && panes.setKind(view.kind)}
          style="transform: translateX({dragging ? drag.dx : 0}px); z-index: {dragging ? 1 : 0}"
          class="flex shrink-0 touch-none select-none {drag.dragging ? 'pointer-events-none' : ''}"
        >
          <TooltipIconButton label={t(view.label)} selected={active} tabindex={-1}>
            <view.icon />
          </TooltipIconButton>
        </div>
      {/each}
    </div>
    <div class="flex items-center">{@render actions()}</div>
  </div>
{:else}
  <div class="flex shrink-0 items-center">{@render actions()}</div>
{/if}
