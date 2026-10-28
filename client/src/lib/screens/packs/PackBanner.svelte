<script lang="ts">
  import { chatBackground } from "$lib/data/chatBackground.svelte";
  import { usedBy } from "$lib/design/packs/library";
  import type { Pack } from "$lib/design/packs/model";
  import { packs } from "$lib/design/packs/registry.svelte";
  import { THEME_KINDS } from "$lib/design/packs/schema";
  import { theme } from "$lib/design/theme.svelte";
  import ChatBackdrop from "$lib/screens/chat/ChatBackdrop.svelte";

  interface Props {
    pack: Pack;
  }

  const { pack }: Props = $props();

  const LINES = [55, 46, 51];

  const used = $derived(usedBy(pack));
  const offered = $derived(
    used.themes.length ? used.themes : THEME_KINDS.flatMap((kind) => pack.themes.find((item) => item.kind === kind) ?? []),
  );
  const chosen = $derived(offered.find((item) => item.kind === theme.modeKind) ?? offered[0] ?? null);
  const shown = $derived((chosen && packs.themesIn(pack).find((item) => item.id === chosen.id)) || theme.current);
  const colors = $derived(shown.colors);
  const accent = $derived(used.accent?.color ?? (chosen ? shown.accent : (pack.accents[0]?.color ?? null)));
  const backdrop = $derived((used.background ?? pack.backgrounds[0])?.id ?? null);
</script>

{#snippet bar(left: number, top: number, width: number, height: number, color: string, opacity: number)}
  <span
    class="absolute rounded-full"
    style="left: {left}%; top: {top}%; width: {width}%; height: {height}%; background: {color}; opacity: {opacity}"
  ></span>
{/snippet}

<div
  aria-hidden="true"
  class="relative aspect-[3/1] w-full shrink-0 overflow-hidden rounded-panel"
  style="background: {colors.surface}"
>
  <span class="absolute rounded-md" style="left: 2%; top: 22%; width: 21%; height: 11%; background: {colors['surface-variant']}"></span>
  {@render bar(3.5, 9, 12, 5, colors["on-background"], 0.7)}
  {@render bar(3.5, 25.5, 15, 4, colors["on-background"], 0.6)}
  {@render bar(3.5, 40, 17, 4, colors["on-surface-variant"], 0.5)}
  {@render bar(3.5, 52, 13, 4, colors["on-surface-variant"], 0.5)}
  {@render bar(3.5, 64, 16, 4, colors["on-surface-variant"], 0.5)}
  <div class="absolute overflow-hidden rounded-lg" style="left: 26%; top: 5%; right: 2%; bottom: 5%; background: {colors.background}">
    {#if backdrop}
      <ChatBackdrop id={backdrop} effects={chatBackground.effectsOf(backdrop)} />
    {/if}
    {@render bar(3, 8, 16, 6, colors["on-background"], 0.7)}
    {@render bar(3, 17, 9, 4, colors["on-surface-variant"], 0.5)}
    {#each LINES as width, index (index)}
      {@render bar(3, 32 + index * 8, width, 4, colors["on-background"], 0.45)}
    {/each}
    <span
      class="absolute rounded-lg"
      style="right: 3%; top: 58%; width: 30%; height: 12%; background: {colors['surface-variant']}"
    ></span>
    <span
      class="absolute rounded-xl"
      style="left: 3%; right: 3%; bottom: 7%; height: 17%; background: {colors['surface-variant']}"
    ></span>
    {#if accent}
      <span
        class="absolute aspect-square rounded-full"
        style="right: 4.5%; bottom: 10%; height: 11%; background: {accent}"
      ></span>
    {/if}
  </div>
</div>
