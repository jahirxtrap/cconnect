<script lang="ts">
  import Check from "@lucide/svelte/icons/check";
  import X from "@lucide/svelte/icons/x";
  import { untrack } from "svelte";
  import { ACCENTS, DYNAMIC_ACCENT } from "$lib/design/accents";
  import { theme } from "$lib/design/theme.svelte";
  import { t } from "$lib/i18n/index.svelte";
  import ActionButton from "$lib/ui/ActionButton.svelte";
  import CompactDialog from "$lib/ui/CompactDialog.svelte";
  import SwitchRow from "$lib/ui/SwitchRow.svelte";
  import { SWATCH_CLASS, SWATCH_GRID_CLASS, swatchBorder } from "$lib/ui/swatch";

  interface Props {
    onDismiss: () => void;
    title?: string;
    selected?: number | null;
    showNone?: boolean;
    closeOnPick?: boolean;
    onSelect?: (index: number | null) => void;
  }

  const {
    onDismiss,
    title = t("ACCENT"),
    selected = null,
    showNone = false,
    closeOnPick = false,
    onSelect,
  }: Props = $props();

  const DEFAULT_INDEX = 4;

  let picked = $state<number | null>(untrack(() => selected));
  let lastIndex = $state(untrack(() => (selected !== null && selected !== DYNAMIC_ACCENT ? selected : DEFAULT_INDEX)));

  const dynamic = $derived(picked === DYNAMIC_ACCENT);

  const apply = (value: number | null) => {
    picked = value;
    onSelect?.(value);
  };

  const pick = (value: number | null) => {
    apply(value);
    if (closeOnPick) onDismiss();
  };

  const setDynamic = (on: boolean) => apply(on ? DYNAMIC_ACCENT : showNone ? null : lastIndex);
</script>

<CompactDialog {title} {onDismiss}>
  {#snippet buttons()}
    <ActionButton text={t("CANCEL")} onclick={onDismiss} />
  {/snippet}

  <SwitchRow
    class="mb-4"
    title={t("ACCENT_DYNAMIC")}
    checked={dynamic}
    onChange={setDynamic}
  >
    {#snippet leading()}
      <span class="size-5 rounded-full" style="background: {theme.systemAccent ?? theme.appAccent}"></span>
    {/snippet}
  </SwitchRow>

  <div class={SWATCH_GRID_CLASS} class:opacity-40={dynamic}>
    {#if showNone}
      <button
        type="button"
        onclick={() => pick(null)}
        aria-label={t("COLOR_NONE")}
        class="{SWATCH_CLASS} bg-surface-variant text-on-surface-variant {swatchBorder(picked === null)}"
      >
        {#if picked === null}
          <Check size={20} />
        {:else}
          <X size={18} />
        {/if}
      </button>
    {/if}
    {#each ACCENTS as accent, index (accent.name)}
      <button
        type="button"
        title={accent.name}
        aria-label={accent.name}
        onclick={() => {
          lastIndex = index;
          pick(index);
        }}
        class="{SWATCH_CLASS} text-white {swatchBorder(!dynamic && picked === index)}"
        style="background: {accent.value}"
      >
        {#if !dynamic && picked === index}
          <Check size={20} />
        {/if}
      </button>
    {/each}
  </div>
</CompactDialog>
