<script lang="ts">
  import Check from "@lucide/svelte/icons/check";
  import X from "@lucide/svelte/icons/x";
  import { untrack } from "svelte";
  import { t } from "$lib/i18n/index.svelte";
  import Button from "./Button.svelte";
  import CompactDialog from "./CompactDialog.svelte";
  import { SWATCH_CLASS, SWATCH_GRID_CLASS, swatchBorder } from "./swatch";

  export interface ColorOption {
    value: string;
    color: string;
    label: string;
  }

  interface Props {
    title: string;
    options: ColorOption[];
    selected: string | null;
    onSelect: (value: string | null) => void;
    onDismiss: () => void;
  }

  const { title, options, selected, onSelect, onDismiss }: Props = $props();


  let picked = $state<string | null>(untrack(() => selected || null));
</script>

<CompactDialog {title} {onDismiss}>
  {#snippet buttons()}
    <Button onclick={onDismiss} variant="outlined">{t("CANCEL")}</Button>
    <Button
      onclick={() => {
        onSelect(picked);
        onDismiss();
      }}>{t("SAVE")}</Button
    >
  {/snippet}
  <div class={SWATCH_GRID_CLASS}>
    <button
      type="button"
      onclick={() => (picked = null)}
      aria-label={t("COLOR_NONE")}
      class="{SWATCH_CLASS} bg-surface-variant text-on-surface-variant {swatchBorder(picked === null)}"
    >
      {#if picked === null}
        <Check size={20} />
      {:else}
        <X size={18} />
      {/if}
    </button>
    {#each options as option (option.value)}
      <button
        type="button"
        onclick={() => (picked = option.value)}
        aria-label={option.label}
        title={option.label}
        style="background: {option.color}"
        class="{SWATCH_CLASS} text-white {swatchBorder(picked === option.value)}"
      >
        {#if picked === option.value}
          <Check size={20} />
        {/if}
      </button>
    {/each}
  </div>
</CompactDialog>
