<script lang="ts">
  import Check from "@lucide/svelte/icons/check";
  import { ACCENTS } from "$lib/design/accents";
  import { theme } from "$lib/design/theme.svelte";
  import { t } from "$lib/i18n/index.svelte";
  import Button from "$lib/ui/Button.svelte";
  import CompactDialog from "$lib/ui/CompactDialog.svelte";

  interface Props {
    onDismiss: () => void;
  }

  const { onDismiss }: Props = $props();
</script>

<CompactDialog title={t("ACCENT")} {onDismiss}>
  {#snippet buttons()}
    <Button onclick={onDismiss} variant="outlined">{t("CLOSE")}</Button>
  {/snippet}

  <div class="grid w-80 max-w-full grid-cols-6 gap-3">
    {#each ACCENTS as accent, index (accent.name)}
      <button
        type="button"
        title={accent.name}
        aria-label={accent.name}
        onclick={() => theme.setAccent(index)}
        class="flex size-9 cursor-pointer items-center justify-center rounded-full transition-transform hover:scale-105"
        style="background: {accent.value}"
      >
        {#if theme.accentIndex === index}
          <Check size={18} class="text-on-accent" />
        {/if}
      </button>
    {/each}
  </div>
</CompactDialog>
