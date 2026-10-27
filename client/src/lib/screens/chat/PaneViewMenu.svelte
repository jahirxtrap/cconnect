<script lang="ts">
  import LayoutDashboard from "@lucide/svelte/icons/layout-dashboard";
  import { t } from "$lib/i18n/index.svelte";
  import { layout } from "$lib/platform/layout.svelte";
  import MenuItem from "$lib/ui/MenuItem.svelte";
  import PopupMenu from "$lib/ui/PopupMenu.svelte";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";
  import { panes } from "./panes.svelte";
  import { paneViews } from "./paneViews.svelte";

  interface Props {
    all?: boolean;
  }

  const { all = false }: Props = $props();

  const drag = paneViews.menuDrag;
  const views = $derived(paneViews.menuOf(all));
  const current = $derived(views.find((view) => view.kind === panes.kind) ?? null);
</script>

<span use:paneViews.trigger class="relative inline-flex rounded-full">
  <PopupMenu open={paneViews.menuOpen} onOpenChange={(value) => (paneViews.menuOpen = value)} label={t("PANEL_VIEW")}>
    {#snippet triggerChild(props)}
      <TooltipIconButton label={t("PANEL_VIEW")} selected={!!current && !layout.mobile} active={!!current} {...props}>
        {#if current}
          <current.icon />
        {:else}
          <LayoutDashboard />
        {/if}
      </TooltipIconButton>
    {/snippet}
    <div use:paneViews.menuList class="contents">
      {#each views as view, index (view.kind)}
        {@const dragged = drag.id === view.kind}
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
          data-row={view.kind}
          data-group=""
          data-index={index}
          class="relative {dragged ? 'z-10' : ''} {drag.active ? 'pointer-events-none' : ''}"
          onpointerdown={(event) => !all && paneViews.beginMenuDrag(event, view.kind, index)}
        >
          <div
            class={dragged ? "rounded-md bg-hover" : ""}
            style="transform: translateY({dragged ? drag.offset : drag.shiftFor(view.kind)}px); transition: {dragged ||
            !drag.active
              ? 'none'
              : 'transform 160ms cubic-bezier(0.2, 0, 0, 1)'}"
          >
            <MenuItem
              icon={view.icon}
              text={t(view.label)}
              selected={panes.kind === view.kind}
              onclick={() => panes.setKind(view.kind)}
            />
          </div>
        </div>
      {/each}
    </div>
  </PopupMenu>
  {#if paneViews.overMenu}
    <span
      class="pointer-events-none absolute inset-0 rounded-full bg-accent-soft outline-2 -outline-offset-2 outline-accent"
    ></span>
  {/if}
</span>
