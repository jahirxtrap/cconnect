<script lang="ts">
  import { untrack } from "svelte";
  import ArrowLeftRight from "@lucide/svelte/icons/arrow-left-right";
  import LayoutDashboard from "@lucide/svelte/icons/layout-dashboard";
  import { t } from "$lib/i18n/index.svelte";
  import { layout } from "$lib/platform/layout.svelte";
  import MenuItem from "$lib/ui/MenuItem.svelte";
  import PopupMenu from "$lib/ui/PopupMenu.svelte";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";
  import { panes } from "./panes.svelte";
  import { paneRole } from "./paneSurface";
  import { paneViews } from "./paneViews.svelte";
  import type { PaneRole } from "./tabs.svelte";

  interface Props {
    all?: boolean;
    role?: PaneRole;
  }

  const { all = false, role: given }: Props = $props();

  const surface = paneRole();
  const role = untrack(() => given) ?? surface ?? "right";
  const bar = paneViews.of(role);
  const drag = bar.menuDrag;
  const views = $derived(paneViews.menuOf(all));
  const current = $derived(views.find((view) => view.kind === panes.viewAt(role)) ?? null);
</script>

<span use:bar.trigger class="relative inline-flex rounded-full">
  <PopupMenu open={bar.menuOpen} onOpenChange={(value) => (bar.menuOpen = value)} label={t("PANEL_VIEW")}>
    {#snippet triggerChild(props)}
      <TooltipIconButton label={t("PANEL_VIEW")} selected={!!current && !layout.mobile} active={!!current} {...props}>
        {#if current}
          <current.icon />
        {:else}
          <LayoutDashboard />
        {/if}
      </TooltipIconButton>
    {/snippet}
    <div use:bar.menuList class="contents">
      {#each views as view, index (view.kind)}
        {@const dragged = drag.id === view.kind}
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
          data-row={view.kind}
          data-group=""
          data-index={index}
          class="relative {dragged ? 'z-10' : ''} {drag.active ? 'pointer-events-none' : ''}"
          onpointerdown={(event) => bar.beginMenuDrag(event, view.kind, index, all)}
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
              selected={panes.viewAt(role) === view.kind}
              onclick={() => panes.setView(role, view.kind)}
            />
          </div>
        </div>
      {/each}
    </div>
    {#if panes.swappable}
      <MenuItem icon={ArrowLeftRight} text={t("SWAP_PANES")} onclick={() => panes.swap()} />
    {/if}
  </PopupMenu>
  {#if bar.overMenu}
    <span
      class="pointer-events-none absolute inset-0 rounded-full bg-accent-soft outline-2 -outline-offset-2 outline-accent"
    ></span>
  {/if}
</span>
