<script lang="ts">
  import Check from "@lucide/svelte/icons/check";
  import X from "@lucide/svelte/icons/x";
  import { untrack } from "svelte";
  import { DYNAMIC_ACCENT, THEME_ACCENT } from "$lib/design/accents";
  import { packs } from "$lib/design/packs/registry.svelte";
  import { theme } from "$lib/design/theme.svelte";
  import { t } from "$lib/i18n/index.svelte";
  import ActionButton from "$lib/ui/ActionButton.svelte";
  import CompactDialog from "$lib/ui/CompactDialog.svelte";
  import DialogSelectItem from "$lib/ui/DialogSelectItem.svelte";
  import SectionHeader from "$lib/ui/SectionHeader.svelte";
  import { SWATCH_CLASS, SWATCH_GRID_CLASS, swatchBorder } from "$lib/ui/swatch";

  interface Props {
    onDismiss: () => void;
    title?: string;
    selected?: string | null;
    showNone?: boolean;
    closeOnPick?: boolean;
    onSelect?: (choice: string | null) => void;
  }

  const { onDismiss, title = t("ACCENT"), selected = null, showNone = false, closeOnPick = false, onSelect }: Props =
    $props();

  const SOURCES = [
    { choice: DYNAMIC_ACCENT, label: "ACCENT_DYNAMIC" },
    { choice: THEME_ACCENT, label: "ACCENT_THEME" },
  ];

  const groups = $derived(
    packs.all
      .filter((pack) => pack.accents.length)
      .map((pack) => ({ id: pack.info.id, name: pack.info.name, accents: pack.accents })),
  );

  let picked = $state<string | null>(untrack(() => selected));

  const pick = (choice: string | null) => {
    picked = choice;
    onSelect?.(choice);
    if (closeOnPick) onDismiss();
  };
</script>

<CompactDialog {title} {onDismiss}>
  {#snippet buttons()}
    <ActionButton text={t("CANCEL")} onclick={onDismiss} />
  {/snippet}

  <div class="mb-4">
    {#each SOURCES as source (source.choice)}
      <DialogSelectItem label={t(source.label)} selected={picked === source.choice} onclick={() => pick(source.choice)}>
        {#snippet trailing()}
          <span class="flex size-8 shrink-0 items-center justify-center">
            <span class="size-5 rounded-full" style="background: {theme.resolve(source.choice)}"></span>
          </span>
        {/snippet}
      </DialogSelectItem>
    {/each}
  </div>

  {#each groups as group, index (group.id)}
    {#if groups.length > 1}
      <SectionHeader label={group.name} divider={index > 0} />
    {/if}
    <div class="{SWATCH_GRID_CLASS} {index < groups.length - 1 ? 'mb-3' : ''}">
      {#if showNone && index === 0}
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
      {#each group.accents as accent (accent.id)}
        <button
          type="button"
          title={accent.name}
          aria-label={accent.name}
          onclick={() => pick(accent.id)}
          class="{SWATCH_CLASS} text-white {swatchBorder(picked === accent.id)}"
          style="background: {accent.color}"
        >
          {#if picked === accent.id}
            <Check size={20} />
          {/if}
        </button>
      {/each}
    </div>
  {/each}
</CompactDialog>
