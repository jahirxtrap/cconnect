<script lang="ts">
  import X from "@lucide/svelte/icons/x";
  import { t } from "$lib/i18n/index.svelte";
  import { isTouch } from "$lib/platform";
  import Button from "./Button.svelte";
  import TooltipIconButton from "./TooltipIconButton.svelte";

  interface Props {
    text: string;
    onDismiss: () => void;
    actionLabel?: string | null;
    onAction?: () => void;
  }

  const { text, onDismiss, actionLabel, onAction }: Props = $props();
</script>

<div class="flex w-full items-center rounded-lg bg-surface-variant py-1 pr-2 pl-4 shadow-lg">
  <p class="min-w-0 flex-1 py-2 text-body-md">{text}</p>
  {#if actionLabel && onAction}
    <Button onclick={onAction}>{actionLabel}</Button>
  {/if}
  {#if !isTouch}
    <TooltipIconButton label={t("CLOSE")} onclick={onDismiss}>
      <X size={20} />
    </TooltipIconButton>
  {/if}
</div>
