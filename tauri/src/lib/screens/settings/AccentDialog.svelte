<script lang="ts">
  import Check from "@lucide/svelte/icons/check";
  import { ACCENTS } from "$lib/design/accents";
  import { theme } from "$lib/design/theme.svelte";
  import { t } from "$lib/i18n/index.svelte";
  import { isTauri } from "$lib/platform";
  import Button from "$lib/ui/Button.svelte";
  import CompactDialog from "$lib/ui/CompactDialog.svelte";
  import CompactSwitch from "$lib/ui/CompactSwitch.svelte";

  interface Props {
    onDismiss: () => void;
  }

  const { onDismiss }: Props = $props();
</script>

<CompactDialog title={t("ACCENT")} {onDismiss}>
  {#snippet buttons()}
    <Button onclick={onDismiss} variant="outlined">{t("CLOSE")}</Button>
  {/snippet}

  {#if isTauri && theme.systemAccent}
    <button
      type="button"
      onclick={() => theme.setDynamicColor(!theme.dynamicColor)}
      class="mb-4 flex w-full cursor-pointer items-center gap-3 rounded-sm px-1 py-1.5 text-left transition-colors hover:bg-on-surface/8"
    >
      <span class="size-5 shrink-0 rounded-full" style="background: {theme.systemAccent}"></span>
      <span class="min-w-0 flex-1 text-body-md">{t("ACCENT_DYNAMIC")}</span>
      <CompactSwitch checked={theme.dynamicColor} onCheckedChange={(value) => theme.setDynamicColor(value)} />
    </button>
  {/if}

  <div class="grid grid-cols-[repeat(5,2.5rem)] justify-between gap-y-3" class:opacity-40={theme.dynamicColor}>
    {#each ACCENTS as accent, index (accent.name)}
      <button
        type="button"
        title={accent.name}
        aria-label={accent.name}
        onclick={() => theme.setAccent(index)}
        class="flex size-10 cursor-pointer items-center justify-center rounded-full text-white transition-shadow hover:shadow-[inset_0_0_0_2px_white] {theme.accentIndex ===
        index
          ? 'border-2 border-on-surface'
          : 'border border-outline-variant'}"
        style="background: {accent.value}"
      >
        {#if theme.accentIndex === index}
          <Check size={20} />
        {/if}
      </button>
    {/each}
  </div>
</CompactDialog>
