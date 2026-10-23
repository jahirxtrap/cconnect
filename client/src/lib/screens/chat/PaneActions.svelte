<script lang="ts">
  import PanelRightClose from "@lucide/svelte/icons/panel-right-close";
  import PanelRightOpen from "@lucide/svelte/icons/panel-right-open";
  import { screenFor } from "$lib/app/screens";
  import { t } from "$lib/i18n/index.svelte";
  import { layout } from "$lib/platform/layout.svelte";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";
  import CenterViewToggle from "./CenterViewToggle.svelte";
  import { panes } from "./panes.svelte";
</script>

<div class="flex shrink-0 items-center">
  {#if layout.mobile}
    {#if !panes.onSecondary}
      {@const Tool = screenFor(panes.tool).icon}
      <TooltipIconButton label={t("PANEL_RIGHT")} shortcut="panel.right" onclick={() => panes.setKind(panes.tool)}>
        <Tool />
      </TooltipIconButton>
    {/if}
  {:else}
    {#if panes.viewing}
      <CenterViewToggle />
    {/if}
    <TooltipIconButton label={t("PANEL_RIGHT")} shortcut="panel.right" onclick={() => panes.setOpen(!panes.open)}>
      {#if panes.open}
        <PanelRightClose />
      {:else}
        <PanelRightOpen />
      {/if}
    </TooltipIconButton>
  {/if}
</div>
