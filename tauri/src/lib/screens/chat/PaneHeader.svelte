<script lang="ts">
  import ArrowLeft from "@lucide/svelte/icons/arrow-left";
  import type { Snippet } from "svelte";
  import { t } from "$lib/i18n/index.svelte";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";
  import { panes } from "./panes.svelte";
  import PaneActions from "./PaneActions.svelte";
  import { PANE_HEADER_CLASS, paneFocusBorder } from "./paneChrome";

  interface Props {
    title: string;
    actions?: Snippet;
    leading?: Snippet;
    onBack?: () => void;
  }

  const { title, actions, leading, onBack }: Props = $props();

  const focused = $derived(panes.focused === "right");
</script>

<div
  class="gap-1 pr-1 {leading || onBack ? 'pl-1' : 'pl-3'} {PANE_HEADER_CLASS} {paneFocusBorder(focused)}"
>
  {#if leading}
    {@render leading()}
  {:else if onBack}
    <TooltipIconButton label={t("BACK")} class="size-8" onclick={onBack}>
      <ArrowLeft />
    </TooltipIconButton>
  {/if}
  <p class="min-w-0 flex-1 truncate text-label-lg">{title}</p>
  <PaneActions {actions} />
</div>
