<script lang="ts">
  import ChevronUp from "@lucide/svelte/icons/chevron-up";
  import { packs } from "$lib/design/packs/registry.svelte";
  import { theme } from "$lib/design/theme.svelte";
  import { t } from "$lib/i18n/index.svelte";
  import FoldGrid from "$lib/ui/FoldGrid.svelte";
  import { TILE_IDLE_CLASS, TILE_LINE_CLASS, TILE_SELECTED_CLASS } from "$lib/ui/tile";
  import TooltipWrap from "$lib/ui/TooltipWrap.svelte";
  import { terminalPalette, type ThemeTab } from "./settingsValues";

  interface Props {
    tab: ThemeTab;
  }

  const { tab }: Props = $props();

  const CARD_MIN = 112;
  const CARD_GAP = 8;
  const PREVIEW_CLASS = "relative h-16 w-full overflow-hidden rounded-lg";

  interface Card {
    id: string;
    name: string;
    surface: string;
    background: string;
    raised: string;
    text: string;
    muted: string;
    accent: string;
    palette: string[];
  }

  const cards = $derived<Card[]>(
    tab === "terminal"
      ? packs.terminals.map((item) => ({
          id: item.id,
          name: item.name,
          surface: item.colors.background,
          background: item.colors.background,
          raised: item.colors.background,
          text: item.colors.foreground,
          muted: item.colors.foreground,
          accent: item.colors.foreground,
          palette: terminalPalette(item),
        }))
      : packs.themesOf(tab).map((item) => ({
          id: item.id,
          name: item.name,
          surface: item.colors.surface,
          background: item.colors.background,
          raised: item.colors["surface-variant"],
          text: item.colors["on-background"],
          muted: item.colors["on-surface-variant"],
          accent: item.accent,
          palette: [],
        })),
  );

  const selected = $derived(
    tab === "terminal" ? packs.terminalOf(theme.terminalId).id : packs.themeOf(tab, theme.themeIds[tab]).id,
  );

  const choose = (id: string) => {
    if (tab === "terminal") theme.setTerminal(id);
    else theme.setTheme(tab, id);
  };
</script>

{#snippet bar(left: number, top: number, width: number, height: number, color: string, opacity: number)}
  <span
    class="absolute rounded-full"
    style="left: {left}%; top: {top}%; width: {width}%; height: {height}%; background: {color}; opacity: {opacity}"
  ></span>
{/snippet}

{#snippet sketch(entry: Card)}
  {#if tab === "terminal"}
    {@const [red, green, yellow, blue, magenta, cyan] = entry.palette}
    {@render bar(8, 18, 26, 9, entry.text, 0.85)}
    {@render bar(38, 18, 18, 9, blue, 0.85)}
    {@render bar(8, 38, 44, 9, green, 0.85)}
    {@render bar(8, 58, 20, 9, yellow, 0.85)}
    {@render bar(32, 58, 24, 9, magenta, 0.85)}
    {@render bar(8, 78, 14, 9, red, 0.85)}
    {@render bar(26, 78, 30, 9, cyan, 0.85)}
  {:else}
    <span class="absolute rounded-sm" style="left: 5%; top: 14%; width: 20%; height: 16%; background: {entry.raised}"></span>
    {@render bar(7, 42, 16, 7, entry.muted, 0.5)}
    {@render bar(7, 56, 16, 7, entry.muted, 0.5)}
    {@render bar(7, 70, 16, 7, entry.muted, 0.5)}
    <span class="absolute overflow-hidden rounded-md" style="left: 30%; top: 8%; right: 4%; bottom: 8%; background: {entry.background}">
      {@render bar(7, 14, 30, 10, entry.text, 0.7)}
      {@render bar(7, 32, 48, 7, entry.text, 0.45)}
      <span class="absolute rounded-sm" style="right: 7%; top: 46%; width: 36%; height: 16%; background: {entry.raised}"></span>
      <span class="absolute rounded-full" style="left: 7%; right: 7%; bottom: 10%; height: 18%; background: {entry.raised}"></span>
      <span class="absolute aspect-square rounded-full" style="right: 10%; bottom: 13%; height: 12%; background: {entry.accent}"></span>
    </span>
  {/if}
{/snippet}

{#snippet card(entry: Card)}
  {@const active = entry.id === selected}
  <TooltipWrap label={entry.name} class="flex">
    <button
      type="button"
      aria-label={entry.name}
      aria-pressed={active}
      onclick={() => choose(entry.id)}
      style="background: {entry.surface}"
      class="group {PREVIEW_CLASS} cursor-pointer"
    >
      {@render sketch(entry)}
      <span class="{TILE_LINE_CLASS} {active ? TILE_SELECTED_CLASS : TILE_IDLE_CLASS}"></span>
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
      class="group {PREVIEW_CLASS} flex cursor-pointer items-center justify-center text-body-md text-on-surface-variant hover:text-on-surface"
    >
      {#if expanded}
        <ChevronUp size={20} />
      {:else}
        +{hidden}
      {/if}
      <span class="{TILE_LINE_CLASS} border-dashed {TILE_IDLE_CLASS}"></span>
    </button>
  </TooltipWrap>
{/snippet}

<FoldGrid items={cards} keyOf={(entry) => entry.id} {selected} cell={CARD_MIN} gap={CARD_GAP} stretch item={card} {more} />
