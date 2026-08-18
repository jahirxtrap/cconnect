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
  const SWATCH_CLASS =
    "flex size-10 cursor-pointer items-center justify-center rounded-full transition-shadow hover:shadow-[inset_0_0_0_2px_white]";

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
    <ActionButton text={t("CLOSE")} onclick={onDismiss} />
  {/snippet}

  <SwitchRow
    class="mb-4"
    title={t("ACCENT_DYNAMIC")}
    checked={dynamic}
    onChange={setDynamic}
  >
    {#snippet leading()}
      <span class="size-5 rounded-full" style="background: {theme.systemAccent ?? theme.accent}"></span>
    {/snippet}
  </SwitchRow>

  <div class="grid grid-cols-[repeat(5,2.5rem)] justify-between gap-y-3" class:opacity-40={dynamic}>
    {#if showNone}
      <button
        type="button"
        onclick={() => pick(null)}
        aria-label={t("COLOR_NONE")}
        class="{SWATCH_CLASS} bg-surface-variant text-on-surface-variant {picked === null
          ? 'border-2 border-on-surface'
          : 'border border-outline-variant'}"
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
        class="{SWATCH_CLASS} text-white {!dynamic && picked === index
          ? 'border-2 border-on-surface'
          : 'border border-outline-variant'}"
        style="background: {accent.value}"
      >
        {#if !dynamic && picked === index}
          <Check size={20} />
        {/if}
      </button>
    {/each}
  </div>
</CompactDialog>
