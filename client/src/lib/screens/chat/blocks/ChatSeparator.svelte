<script lang="ts">
  import ArrowUp from "@lucide/svelte/icons/arrow-up";
  import { formatDay } from "$lib/data/time";
  import { t } from "$lib/i18n/index.svelte";
  import LoadingIndicator from "$lib/ui/LoadingIndicator.svelte";

  interface Props {
    millis?: number | null;
    onEarlier?: (() => void) | null;
    loading?: boolean;
  }

  const { millis = null, onEarlier = null, loading = false }: Props = $props();

  const PILL_CLASS = "flex h-6 items-center rounded-full bg-surface-variant px-3 text-label-sm text-on-surface-variant";
  const GLYPH_CLASS = "size-(--chat-glyph) shrink-0";
</script>

<div class="flex w-full justify-center gap-2 px-(--page-inset) py-(--chat-gap-sm) select-none">
  {#if millis !== null}
    <span class={PILL_CLASS}>{formatDay(millis)}</span>
  {/if}
  {#if onEarlier}
    <button
      type="button"
      disabled={loading}
      onclick={onEarlier}
      class="{PILL_CLASS} ripple cursor-pointer gap-1.5 transition-colors hover:text-on-surface disabled:cursor-default"
    >
      {#if loading}
        <LoadingIndicator class="{GLYPH_CLASS} text-accent" />
      {:else}
        <ArrowUp class={GLYPH_CLASS} />
      {/if}
      {t("EARLIER_MESSAGES")}
    </button>
  {/if}
</div>
