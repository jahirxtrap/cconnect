<script lang="ts">
  import ChevronUp from "@lucide/svelte/icons/chevron-up";
  import X from "@lucide/svelte/icons/x";
  import { chatBackground } from "$lib/data/chatBackground.svelte";
  import { NO_BACKGROUND } from "$lib/design/backgrounds";
  import { packs } from "$lib/design/packs/registry.svelte";
  import { t } from "$lib/i18n/index.svelte";
  import ChatBackdrop from "$lib/screens/chat/ChatBackdrop.svelte";
  import FoldGrid from "$lib/ui/FoldGrid.svelte";
  import Pressable from "$lib/ui/Pressable.svelte";
  import { TILE_IDLE_CLASS, TILE_LINE_CLASS, TILE_SELECTED_CLASS } from "$lib/ui/tile";
  import TooltipWrap from "$lib/ui/TooltipWrap.svelte";
  import { BACKGROUND_TILE_CLASS, pickBackground } from "./backgroundChoice";
  import { backgroundLabel } from "./settingsValues";

  interface Props {
    onAdjust: () => void;
  }

  const { onAdjust }: Props = $props();

  const TILE_WIDTH = 48;
  const TILE_GAP = 8;

  const ids = $derived([
    NO_BACKGROUND,
    ...packs.all.flatMap((pack) => pack.backgrounds.map((background) => background.id)),
    ...chatBackground.uploads,
  ]);

</script>

{#snippet tile(id: string)}
  <TooltipWrap label={backgroundLabel(id)} class="flex">
    <Pressable hover={false} onclick={() => pickBackground(id, onAdjust)} class={BACKGROUND_TILE_CLASS}>
      {#if id === NO_BACKGROUND}
        <X size={18} class="absolute inset-0 m-auto text-on-surface-variant" />
      {:else}
        <ChatBackdrop thumbnail {id} effects={chatBackground.effectsOf(id)} />
      {/if}
      <span class="{TILE_LINE_CLASS} {chatBackground.current === id ? TILE_SELECTED_CLASS : TILE_IDLE_CLASS}"></span>
    </Pressable>
  </TooltipWrap>
{/snippet}

{#snippet more(expanded: boolean, hidden: number, toggle: () => void)}
  <TooltipWrap label={expanded ? t("SHOW_LESS") : t("SHOW_MORE")} class="flex">
    <Pressable hover={false} onclick={toggle} class="{BACKGROUND_TILE_CLASS} text-body-md text-on-surface-variant hover:text-on-surface">
      <span class="absolute inset-0 flex items-center justify-center">
        {#if expanded}
          <ChevronUp size={18} />
        {:else}
          +{hidden}
        {/if}
      </span>
      <span class="{TILE_LINE_CLASS} border-dashed {TILE_IDLE_CLASS}"></span>
    </Pressable>
  </TooltipWrap>
{/snippet}

<FoldGrid
  items={ids}
  keyOf={(id) => id}
  selected={chatBackground.current}
  cell={TILE_WIDTH}
  gap={TILE_GAP}
  item={tile}
  {more}
/>
