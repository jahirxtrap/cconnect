<script lang="ts">
  import LayoutDashboard from "@lucide/svelte/icons/layout-dashboard";
  import { paneMenuViews } from "$lib/app/screens";
  import { t } from "$lib/i18n/index.svelte";
  import { layout } from "$lib/platform/layout.svelte";
  import MenuItem from "$lib/ui/MenuItem.svelte";
  import PopupMenu from "$lib/ui/PopupMenu.svelte";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";
  import { panes } from "./panes.svelte";

  interface Props {
    all?: boolean;
  }

  const { all = false }: Props = $props();

  const views = $derived(paneMenuViews(layout.mobile, all));
  const current = $derived(views.find((view) => view.kind === panes.kind) ?? null);

  let menu = $state(false);
</script>

<PopupMenu open={menu} onOpenChange={(value) => (menu = value)} label={t("PANEL_VIEW")}>
  {#snippet triggerChild(props)}
    <TooltipIconButton label={t("PANEL_VIEW")} selected={!!current && !layout.mobile} active={!!current} {...props}>
      {#if current}
        <current.icon />
      {:else}
        <LayoutDashboard />
      {/if}
    </TooltipIconButton>
  {/snippet}
  {#each views as view (view.kind)}
    <MenuItem
      icon={view.icon}
      text={t(view.label)}
      selected={panes.kind === view.kind}
      onclick={() => panes.setKind(view.kind)}
    />
  {/each}
</PopupMenu>
