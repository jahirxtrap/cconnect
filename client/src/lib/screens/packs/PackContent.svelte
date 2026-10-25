<script lang="ts">
  import { guessMimeType } from "$lib/data/previewKind";
  import { DEFAULT_EFFECTS } from "$lib/design/backgrounds";
  import { FONT_SAMPLES } from "$lib/design/fonts";
  import { loadFace } from "$lib/design/packs/faces";
  import type { Pack } from "$lib/design/packs/model";
  import type { PackSource } from "$lib/design/packs/reader";
  import { packs } from "$lib/design/packs/registry.svelte";
  import { t } from "$lib/i18n/index.svelte";
  import ChatBackdrop from "$lib/screens/chat/ChatBackdrop.svelte";
  import { fontLabel, packBackgroundLabel, terminalSwatches, themeSwatches } from "$lib/screens/settings/settingsValues";
  import ListRow from "$lib/ui/ListRow.svelte";
  import SectionHeader from "$lib/ui/SectionHeader.svelte";
  import SwatchRow from "$lib/ui/SwatchRow.svelte";

  interface Props {
    pack: Pack;
    source?: PackSource | null;
  }

  const { pack, source = null }: Props = $props();

  type Category = "themes" | "terminals" | "fonts" | "accents" | "backgrounds";

  const LABELS: Record<Category, string> = {
    themes: "THEME",
    terminals: "TERMINAL",
    fonts: "FONT",
    accents: "ACCENT",
    backgrounds: "CHAT_BACKGROUND",
  };

  let images = $state<Record<string, string>>({});

  const themes = $derived(packs.themesIn(pack));
  const terminals = $derived(packs.terminalsIn(pack));
  const counts = $derived<Record<Category, number>>({
    themes: themes.length,
    terminals: terminals.length,
    fonts: pack.fonts.length,
    accents: pack.accents.length,
    backgrounds: pack.backgrounds.length,
  });
  const categories = $derived((Object.keys(LABELS) as Category[]).filter((category) => counts[category] > 0));

  $effect(() => {
    for (const font of pack.fonts) void loadFace(font, source);
  });

  $effect(() => {
    if (!source) return;
    const made = Object.fromEntries(
      pack.backgrounds.flatMap((background) => {
        const bytes = background.file ? source.bytes(background.file) : undefined;
        if (!background.file || !bytes) return [];
        const blob = new Blob([bytes as BlobPart], { type: guessMimeType(background.file) ?? "" });
        return [[background.id, URL.createObjectURL(blob)]];
      }),
    );
    images = made;
    return () => Object.values(made).forEach((url) => URL.revokeObjectURL(url));
  });
</script>

{#snippet swatches(colors: string[])}
  <span class="px-2"><SwatchRow {colors} /></span>
{/snippet}

<div class="flex flex-col">
  {#each categories as category, index (category)}
    <SectionHeader label={t(LABELS[category])} divider={index > 0} />
    {#if category === "themes"}
      {#each themes as item (item.id)}
        <ListRow title={item.name} subtitle={t(`THEME_${item.kind.toUpperCase()}`)}>
          {#snippet trailing()}{@render swatches(themeSwatches(item))}{/snippet}
        </ListRow>
      {/each}
    {:else if category === "terminals"}
      {#each terminals as item (item.id)}
        <ListRow title={item.name}>
          {#snippet trailing()}{@render swatches(terminalSwatches(item))}{/snippet}
        </ListRow>
      {/each}
    {:else if category === "fonts"}
      {#each pack.fonts as item (`${item.kind}:${item.id}`)}
        <ListRow title={fontLabel(item)} subtitle={t(`FONT_${item.kind.toUpperCase()}`)}>
          {#snippet trailing()}
            <span class="flex h-7 min-w-9 items-center justify-center px-1 text-body-lg" style="font-family: {item.family}"
              >{FONT_SAMPLES[item.kind]}</span
            >
          {/snippet}
        </ListRow>
      {/each}
    {:else if category === "accents"}
      <div class="flex flex-wrap gap-2 px-3 py-2">
        {#each pack.accents as accent (accent.id)}
          <span
            title={accent.name}
            class="size-6 rounded-full border border-outline-variant"
            style="background: {accent.color}"
          ></span>
        {/each}
      </div>
    {:else}
      {#each pack.backgrounds as item (item.id)}
        <ListRow title={packBackgroundLabel(item)}>
          {#snippet trailing()}
            <span class="relative mr-2 h-10 w-8 overflow-hidden rounded-md border border-outline-variant bg-background">
              <ChatBackdrop id={item.id} effects={{ ...DEFAULT_EFFECTS, ...item.effects }} src={images[item.id] ?? null} />
            </span>
          {/snippet}
        </ListRow>
      {/each}
    {/if}
  {/each}
</div>
