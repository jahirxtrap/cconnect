<script lang="ts">
  import ArrowLeft from "@lucide/svelte/icons/arrow-left";
  import type { Snippet } from "svelte";
  import { t } from "$lib/i18n/index.svelte";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";
  import { PANE_SUB_CLASS, PANE_TOP_CLASS } from "./paneChrome";
  import { paneRole, usePaneTail } from "./paneSurface";

  interface Props {
    title: string;
    actions?: Snippet;
    leading?: Snippet;
    onBack?: () => void;
  }

  const { title, actions, leading, onBack }: Props = $props();

  const centered = paneRole() === "center";
  const tailOf = usePaneTail();
  const tail = $derived(tailOf());
</script>

<div class={centered || tail ? PANE_TOP_CLASS : PANE_SUB_CLASS}>
  {#if onBack}
    <TooltipIconButton label={t("BACK")} onclick={onBack}>
      <ArrowLeft />
    </TooltipIconButton>
  {/if}
  {@render leading?.()}
  <p class="min-w-0 flex-1 truncate text-label-lg {onBack || leading ? '' : 'pl-1'}">{title}</p>
  {#if actions}
    <div class="flex shrink-0 items-center">{@render actions()}</div>
  {/if}
  {#if tail}
    <div class="flex shrink-0 items-center">{@render tail()}</div>
  {/if}
</div>
