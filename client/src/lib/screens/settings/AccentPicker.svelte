<script lang="ts">
  import Check from "@lucide/svelte/icons/check";
  import ChevronUp from "@lucide/svelte/icons/chevron-up";
  import { DYNAMIC_ACCENT, THEME_ACCENT } from "$lib/design/accents";
  import { textOn } from "$lib/design/contrast";
  import type { PackAccent } from "$lib/design/packs/model";
  import { packs } from "$lib/design/packs/registry.svelte";
  import { theme } from "$lib/design/theme.svelte";
  import { t } from "$lib/i18n/index.svelte";
  import FoldGrid from "$lib/ui/FoldGrid.svelte";
  import SelectChip from "$lib/ui/SelectChip.svelte";
  import { SWATCH_SMALL_CLASS, swatchState } from "$lib/ui/swatch";
  import TooltipWrap from "$lib/ui/TooltipWrap.svelte";

  const SOURCES = [
    { choice: THEME_ACCENT, label: "ACCENT_THEME" },
    { choice: DYNAMIC_ACCENT, label: "ACCENT_DYNAMIC" },
  ];
  const SWATCH_SIZE = 28;
  const SWATCH_GAP = 8;
  const ROWS = 2;
</script>

{#snippet swatch(accent: PackAccent)}
  {@const selected = theme.accentId === accent.id}
  <TooltipWrap label={accent.name} class="flex">
    <button
      type="button"
      aria-label={accent.name}
      aria-pressed={selected}
      onclick={() => theme.setAccent(accent.id)}
      class="{SWATCH_SMALL_CLASS} {swatchState(selected)}"
      style="background: {accent.color}; color: {textOn(accent.color, theme.current.colors)}"
    >
      {#if selected}
        <Check size={16} />
      {/if}
    </button>
  </TooltipWrap>
{/snippet}

{#snippet more(expanded: boolean, hidden: number, toggle: () => void)}
  {@const label = expanded ? t("SHOW_LESS") : t("SHOW_MORE")}
  <TooltipWrap {label} class="flex">
    <button
      type="button"
      aria-label={label}
      aria-expanded={expanded}
      onclick={toggle}
      class="{SWATCH_SMALL_CLASS} border border-dashed border-outline-variant text-caption text-on-surface-variant hover:border-outline hover:text-on-surface"
    >
      {#if expanded}
        <ChevronUp size={16} />
      {:else}
        +{hidden}
      {/if}
    </button>
  </TooltipWrap>
{/snippet}

<div class="flex flex-col gap-2">
  <div class="flex flex-wrap items-center gap-2">
    {#each SOURCES as source (source.choice)}
      <SelectChip
        label={t(source.label)}
        selected={theme.accentId === source.choice}
        onclick={() => theme.setAccent(source.choice)}
      >
        {#snippet leading()}
          <span class="size-3.5 shrink-0 rounded-full" style="background: {theme.resolve(source.choice)}"></span>
        {/snippet}
      </SelectChip>
    {/each}
  </div>
  <FoldGrid
    items={packs.accents}
    keyOf={(accent) => accent.id}
    selected={theme.accentId}
    cell={SWATCH_SIZE}
    gap={SWATCH_GAP}
    rows={ROWS}
    item={swatch}
    {more}
  />
</div>
