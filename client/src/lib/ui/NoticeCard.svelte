<script lang="ts">
  import X from "@lucide/svelte/icons/x";
  import { t } from "$lib/i18n/index.svelte";
  import { isTouch } from "$lib/platform";
  import Button from "./Button.svelte";
  import { FLOAT_HEAD_CLASS, FLOAT_PANEL_WIDTH, FLOAT_SURFACE_CLASS } from "./menuSurface";
  import { swipeDismiss } from "./swipe";
  import TooltipIconButton from "./TooltipIconButton.svelte";

  interface Props {
    text: string;
    onDismiss: () => void;
    actionLabel?: string | null;
    onAction?: () => void;
  }

  const { text, onDismiss, actionLabel, onAction }: Props = $props();
</script>

<div
  use:swipeDismiss={{ onDismiss }}
  class="pointer-events-auto {isTouch ? 'flex items-center gap-1 px-3.5 py-1' : FLOAT_HEAD_CLASS} {FLOAT_PANEL_WIDTH} {FLOAT_SURFACE_CLASS}"
>
  <p class="min-w-0 flex-1 text-body-md">{text}</p>
  {#if actionLabel && onAction}
    <Button onclick={onAction} variant="accent">{actionLabel}</Button>
  {/if}
  {#if !isTouch}
    <TooltipIconButton label={t("CLOSE")} onclick={onDismiss}>
      <X />
    </TooltipIconButton>
  {/if}
</div>
