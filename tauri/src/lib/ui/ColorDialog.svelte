<script lang="ts">
  import Check from "@lucide/svelte/icons/check";
  import X from "@lucide/svelte/icons/x";
  import { untrack } from "svelte";
  import { sessionColorOf } from "$lib/design/sessionColors";
  import { t } from "$lib/i18n/index.svelte";
  import Button from "./Button.svelte";
  import CompactDialog from "./CompactDialog.svelte";

  interface Props {
    colors: string[];
    selected: string | null;
    onSelect: (color: string | null) => void;
    onDismiss: () => void;
  }

  const { colors, selected, onSelect, onDismiss }: Props = $props();

  let picked = $state<string | null>(untrack(() => selected || null));

  const available = $derived(colors.filter((name) => sessionColorOf(name)));
</script>

<CompactDialog title={t("CONVERSATION_COLOR")} {onDismiss}>
  {#snippet buttons()}
    <Button onclick={onDismiss} variant="outlined">{t("CANCEL")}</Button>
    <Button
      onclick={() => {
        onSelect(picked);
        onDismiss();
      }}>{t("SAVE")}</Button
    >
  {/snippet}
  <div class="grid grid-cols-5 justify-items-center gap-y-3">
    <button
      type="button"
      onclick={() => (picked = null)}
      aria-label={t("COLOR_NONE")}
      class="flex size-10 cursor-pointer items-center justify-center rounded-full bg-surface-variant text-on-surface-variant {picked ===
      null
        ? 'border-2 border-on-surface'
        : 'border border-outline-variant'}"
    >
      {#if picked === null}
        <Check size={20} />
      {:else}
        <X size={18} />
      {/if}
    </button>
    {#each available as name (name)}
      <button
        type="button"
        onclick={() => (picked = name)}
        aria-label={name}
        style="background: {sessionColorOf(name)}"
        class="flex size-10 cursor-pointer items-center justify-center rounded-full text-white {picked === name
          ? 'border-2 border-on-surface'
          : 'border border-outline-variant'}"
      >
        {#if picked === name}
          <Check size={20} />
        {/if}
      </button>
    {/each}
  </div>
</CompactDialog>
