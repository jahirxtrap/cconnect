<script lang="ts">
  import ArrowLeft from "@lucide/svelte/icons/arrow-left";
  import type { Snippet } from "svelte";
  import { t } from "$lib/i18n/index.svelte";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";
  import { panes } from "./panes.svelte";
  import PaneActions from "./PaneActions.svelte";
  import { PANE_HEADER_CLASS, paneFocusBorder } from "./paneChrome";
  import { paneRole } from "./paneSurface";

  interface Props {
    title: string;
    actions?: Snippet;
    leading?: Snippet;
    onBack?: () => void;
  }

  const { title, actions, leading, onBack }: Props = $props();

  const role = paneRole() ?? "right";
  const focused = $derived(panes.focused === role);
</script>

<div
  class="gap-1 pr-1 {leading || onBack ? 'pl-1' : 'pl-3'} {PANE_HEADER_CLASS} {paneFocusBorder(focused)}"
>
  {#if onBack || leading}
    <div class="flex shrink-0 items-center">
      {#if onBack}
        <TooltipIconButton label={t("BACK")} class="size-8" onclick={onBack}>
          <ArrowLeft />
        </TooltipIconButton>
      {/if}
      {@render leading?.()}
    </div>
  {/if}
  <p class="min-w-0 flex-1 truncate text-label-lg">{title}</p>
  <PaneActions {actions} {role} />
</div>
