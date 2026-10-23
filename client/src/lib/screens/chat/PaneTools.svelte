<script lang="ts">
  import X from "@lucide/svelte/icons/x";
  import { PANE_TOOL_VIEWS } from "$lib/app/screens";
  import { t } from "$lib/i18n/index.svelte";
  import { layout } from "$lib/platform/layout.svelte";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";
  import { PANE_HEADER_CLASS, paneDim } from "./paneChrome";
  import { panes } from "./panes.svelte";
  import PaneViewMenu from "./PaneViewMenu.svelte";

  interface Props {
    tools?: boolean;
  }

  const { tools = true }: Props = $props();

  const dimmed = $derived(panes.split && panes.focused !== "right");
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
    <div class="flex items-center gap-0.5">
      {#each PANE_TOOL_VIEWS as view (view.kind)}
        <TooltipIconButton label={t(view.label)} selected={panes.kind === view.kind} onclick={() => panes.setKind(view.kind)}>
          <view.icon />
        </TooltipIconButton>
      {/each}
    </div>
    <div class="flex-1"></div>
    <div class="flex items-center">{@render actions()}</div>
  </div>
{:else}
  <div class="flex shrink-0 items-center">{@render actions()}</div>
{/if}
