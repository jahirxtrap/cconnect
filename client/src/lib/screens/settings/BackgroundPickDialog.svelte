<script lang="ts">
  import Plus from "@lucide/svelte/icons/plus";
  import SlidersHorizontal from "@lucide/svelte/icons/sliders-horizontal";
  import X from "@lucide/svelte/icons/x";
  import { chatBackground } from "$lib/data/chatBackground.svelte";
  import { NO_BACKGROUND } from "$lib/design/backgrounds";
  import { packs } from "$lib/design/packs/registry.svelte";
  import { t } from "$lib/i18n/index.svelte";
  import ChatBackdrop from "$lib/screens/chat/ChatBackdrop.svelte";
  import Button from "$lib/ui/Button.svelte";
  import CompactDialog from "$lib/ui/CompactDialog.svelte";
  import Pressable from "$lib/ui/Pressable.svelte";
  import SectionHeader from "$lib/ui/SectionHeader.svelte";
  import { TILE_IDLE_CLASS, TILE_LINE_CLASS, TILE_SELECTED_CLASS } from "$lib/ui/tile";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";
  import { BACKGROUND_TILE_CLASS, pickBackground, uploadBackground } from "./backgroundChoice";
  import { backgroundLabel } from "./settingsValues";

  interface Props {
    onAdjust: () => void;
    onDismiss: () => void;
  }

  const { onAdjust, onDismiss }: Props = $props();

  const TILE_GRID_CLASS = "grid grid-cols-[repeat(auto-fill,minmax(4.5rem,1fr))] gap-2";

  let picker = $state<HTMLInputElement | null>(null);

  const current = $derived(chatBackground.current);
  const builtinBackgrounds = $derived(packs.all.filter((pack) => pack.builtin).flatMap((pack) => pack.backgrounds));
  const packGroups = $derived(packs.all.filter((pack) => !pack.builtin && pack.backgrounds.length));
</script>

{#snippet tile(id: string, caption: string | null)}
  <div class="flex min-w-0 flex-col gap-1">
    <Pressable title={backgroundLabel(id)} hover={false} onclick={() => pickBackground(id, onAdjust)} class={BACKGROUND_TILE_CLASS}>
      {#if id === NO_BACKGROUND}
        <X size={20} class="absolute inset-0 m-auto text-on-surface-variant" />
      {:else}
        <ChatBackdrop thumbnail {id} effects={chatBackground.effectsOf(id)} />
      {/if}
      <span class="{TILE_LINE_CLASS} {current === id ? TILE_SELECTED_CLASS : TILE_IDLE_CLASS}"></span>
    </Pressable>
    {#if caption}
      <p class="truncate text-center text-caption text-on-surface-variant">{caption}</p>
    {/if}
  </div>
{/snippet}

<CompactDialog title={t("CHAT_BACKGROUND")} {onDismiss}>
  {#snippet titleTrailing()}
    <TooltipIconButton label={t("BACKGROUND_SETTINGS")} enabled={current !== NO_BACKGROUND} onclick={onAdjust}>
      <SlidersHorizontal />
    </TooltipIconButton>
  {/snippet}
  {#snippet buttons()}
    <Button onclick={onDismiss} variant="outlined">{t("CLOSE")}</Button>
  {/snippet}

  <div class="flex w-full flex-col gap-3.5">
    <div class="relative aspect-video w-full overflow-hidden rounded-panel border border-outline-variant bg-background">
      {#if current !== NO_BACKGROUND}
        <ChatBackdrop thumbnail id={current} effects={chatBackground.effects} />
      {/if}
    </div>

    <div>
      <SectionHeader label={t("PACKS_BUILTIN")} />
      <div class={TILE_GRID_CLASS}>
        {@render tile(NO_BACKGROUND, backgroundLabel(NO_BACKGROUND))}
        {#each builtinBackgrounds as background (background.id)}
          {@render tile(background.id, backgroundLabel(background.id))}
        {/each}
      </div>
    </div>

    {#each packGroups as pack (pack.info.id)}
      <div>
        <SectionHeader label={pack.info.name} />
        <div class={TILE_GRID_CLASS}>
          {#each pack.backgrounds as background (background.id)}
            {@render tile(background.id, backgroundLabel(background.id))}
          {/each}
        </div>
      </div>
    {/each}

    <div>
      <SectionHeader label={t("BACKGROUNDS_MINE")} />
      <div class={TILE_GRID_CLASS}>
        <div class="flex min-w-0 flex-col gap-1">
          <Pressable
            title={t("UPLOAD")}
            hover={false}
            onclick={() => picker?.click()}
            class="{BACKGROUND_TILE_CLASS} text-on-surface-variant"
          >
            <Plus size={20} class="absolute inset-0 m-auto" />
            <span class="{TILE_LINE_CLASS} border-dashed {TILE_IDLE_CLASS}"></span>
          </Pressable>
          <p class="truncate text-center text-caption text-on-surface-variant">{t("UPLOAD")}</p>
        </div>
        {#each chatBackground.uploads as id (id)}
          {@render tile(id, null)}
        {/each}
      </div>
    </div>
  </div>
  <input bind:this={picker} type="file" accept="image/*" onchange={(event) => void uploadBackground(event, onAdjust)} class="hidden" />
</CompactDialog>
