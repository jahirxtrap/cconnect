<script lang="ts">
  import Eye from "@lucide/svelte/icons/eye";
  import PanelRightClose from "@lucide/svelte/icons/panel-right-close";
  import PanelRightOpen from "@lucide/svelte/icons/panel-right-open";
  import X from "@lucide/svelte/icons/x";
  import type { Snippet } from "svelte";
  import { screenFor } from "$lib/app/screens";
  import { t } from "$lib/i18n/index.svelte";
  import { layout } from "$lib/platform/layout.svelte";
  import { hscrollbar } from "$lib/ui/scrollbar";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";
  import { paneActionClass } from "./paneChrome";
  import { panes } from "./panes.svelte";
  import PaneViewMenu from "./PaneViewMenu.svelte";
  import type { PaneRole } from "./tabs.svelte";

  interface Props {
    actions?: Snippet;
    role?: PaneRole;
  }

  const { actions, role = "right" }: Props = $props();

  const onChat = $derived(role === "center" && layout.mobile);
  const buttonClass = $derived(paneActionClass(!onChat));

  let filled = $state(0);
</script>

<div class="flex min-w-0 shrink items-center">
  {#if actions}
    <div
      bind:clientWidth={filled}
      use:hscrollbar={{ wheel: true }}
      class="no-scrollbar flex min-w-0 items-center overflow-x-auto"
    >
      {@render actions()}
    </div>
    {#if filled > 0}
      <span class="mx-1 h-5 w-px shrink-0 bg-outline-variant"></span>
    {/if}
  {/if}
  {#if role === "right"}
    <PaneViewMenu class={buttonClass} />
    {#if layout.mobile}
      <TooltipIconButton
        label={t("CLOSE")}
        shortcut="panel.right"
        class={buttonClass}
        onclick={() => panes.setOpen(false)}
      >
        <X />
      </TooltipIconButton>
    {/if}
  {:else if onChat}
    {#if !panes.onSecondary}
      {@const Tool = screenFor(panes.tool).icon}
      <TooltipIconButton
        label={t("PANEL_RIGHT")}
        shortcut="panel.right"
        class={buttonClass}
        onclick={() => panes.setKind(panes.tool)}
      >
        <Tool />
      </TooltipIconButton>
    {/if}
  {:else}
    {#if panes.viewing}
      <TooltipIconButton
        label={t("VIEW_IN_CENTER")}
        shortcut="panel.view"
        class={buttonClass}
        onclick={() => panes.showCenterView(!panes.centerView)}
      >
        <Eye class={panes.centerView ? "text-accent" : ""} />
      </TooltipIconButton>
    {/if}
    <TooltipIconButton
      label={t("PANEL_RIGHT")}
      shortcut="panel.right"
      class={buttonClass}
      onclick={() => panes.setOpen(!panes.open)}
    >
      {#if panes.open}
        <PanelRightClose />
      {:else}
        <PanelRightOpen />
      {/if}
    </TooltipIconButton>
  {/if}
</div>
