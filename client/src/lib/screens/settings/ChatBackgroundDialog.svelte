<script lang="ts">
  import Plus from "@lucide/svelte/icons/plus";
  import X from "@lucide/svelte/icons/x";
  import { chatBackground } from "$lib/data/chatBackground.svelte";
  import { settings } from "$lib/data/settings.svelte";
  import {
    BACKGROUND_STYLES,
    DEFAULT_BACKGROUND,
    FIXED_BACKGROUNDS,
    NO_BACKGROUND,
    sameEffects,
    styleOf,
    type BackgroundEffects,
    type BackgroundStyle,
  } from "$lib/design/backgrounds";
  import { packs } from "$lib/design/packs/registry.svelte";
  import { BACKGROUND_FITS, EFFECT_RANGES, type BackgroundFit } from "$lib/design/packs/schema";
  import { t } from "$lib/i18n/index.svelte";
  import { layout } from "$lib/platform/layout.svelte";
  import ChatBackdrop from "$lib/screens/chat/ChatBackdrop.svelte";
  import Button from "$lib/ui/Button.svelte";
  import CompactDialog, { DIALOG_PAGE_CLASS } from "$lib/ui/CompactDialog.svelte";
  import { FIELD_LABEL_CLASS } from "$lib/ui/field";
  import Pressable from "$lib/ui/Pressable.svelte";
  import { viewportScrollbar } from "$lib/ui/scrollbar";
  import SectionHeader from "$lib/ui/SectionHeader.svelte";
  import SegmentedButtons from "$lib/ui/SegmentedButtons.svelte";
  import SelectField from "$lib/ui/SelectField.svelte";
  import Slider from "$lib/ui/Slider.svelte";
  import SwitchRow from "$lib/ui/SwitchRow.svelte";
  import TabPager, { TAB_PAGE_CLASS } from "$lib/ui/TabPager.svelte";
  import { TILE_IDLE_CLASS, TILE_LINE_CLASS, TILE_SELECTED_CLASS } from "$lib/ui/tile";
  import { BACKGROUND_TILE_CLASS, pickBackground, uploadBackground } from "./backgroundChoice";
  import { BACKGROUND_STYLE_LABELS, backgroundLabel } from "./settingsValues";

  interface Props {
    onDismiss: () => void;
  }

  const { onDismiss }: Props = $props();

  const TILE_GRID_CLASS = "grid grid-cols-[repeat(auto-fill,minmax(4.5rem,1fr))] gap-2";  const TABS = ["BACKGROUNDS", "BACKGROUND_ADJUST"];
  const ADJUST_TAB = TABS.indexOf("BACKGROUND_ADJUST");
  const STYLES = Object.keys(BACKGROUND_STYLES) as BackgroundStyle[];
  const FIT_LABELS: Record<BackgroundFit, string> = {
    cover: "BACKGROUND_FIT_COVER",
    contain: "BACKGROUND_FIT_CONTAIN",
  };
  const SLIDERS = [
    { field: "opacity", label: "BACKGROUND_OPACITY" },
    { field: "brightness", label: "BACKGROUND_BRIGHTNESS" },
    { field: "blur", label: "BACKGROUND_BLUR" },
    { field: "saturation", label: "BACKGROUND_SATURATION" },
  ] as const;
  const POSITIONS = [
    { field: "x", label: "BACKGROUND_X" },
    { field: "y", label: "BACKGROUND_Y" },
  ] as const;

  let tab = $state(0);
  let picker = $state<HTMLInputElement | null>(null);

  const current = $derived(chatBackground.current);
  const effects = $derived(chatBackground.effects);
  const style = $derived(styleOf(effects));
  const blank = $derived(current === NO_BACKGROUND);
  const customized = $derived(!sameEffects(effects, chatBackground.defaultsOf(current)));
  const builtinBackgrounds = $derived(packs.all.filter((pack) => pack.builtin).flatMap((pack) => pack.backgrounds));
  const packGroups = $derived(packs.all.filter((pack) => !pack.builtin && pack.backgrounds.length));

  const reveal = () => (tab = ADJUST_TAB);

  const edit = (patch: Partial<BackgroundEffects>) => chatBackground.apply(current, { [current]: { ...effects, ...patch } });

  const reset = () => chatBackground.apply(current, { [current]: chatBackground.defaultsOf(current) });

  const removeUpload = async () => {
    await chatBackground.remove(current);
    chatBackground.apply(DEFAULT_BACKGROUND, {});
  };
</script>

{#snippet tile(id: string, caption: string | null)}
  <div class="flex min-w-0 flex-col gap-1">
    <Pressable title={backgroundLabel(id)} hover={false} onclick={() => pickBackground(id, reveal)} class={BACKGROUND_TILE_CLASS}>
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

{#snippet slider(field: "opacity" | "brightness" | "blur" | "saturation" | "x" | "y", label: string)}
  <div>
    <p class={FIELD_LABEL_CLASS}>{t(label)}</p>
    <Slider
      value={effects[field]}
      min={EFFECT_RANGES[field].min}
      max={EFFECT_RANGES[field].max}
      onChange={(value) => edit({ [field]: value })}
    />
  </div>
{/snippet}

{#snippet preview()}
  <div class="relative aspect-video w-full overflow-hidden rounded-panel border border-outline-variant bg-background">
    {#if !blank}
      <ChatBackdrop thumbnail id={current} {effects} />
    {/if}
  </div>
{/snippet}

{#snippet choices()}
  <div>
    <SectionHeader label={t("PACKS_BUILTIN")} />
    <div class={TILE_GRID_CLASS}>
      {#each FIXED_BACKGROUNDS as id (id)}
        {@render tile(id, backgroundLabel(id))}
      {/each}
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
{/snippet}

{#snippet veil()}
  <SwitchRow
    title={t("BACKGROUND_VEIL")}
    summary={t("BACKGROUND_VEIL_SUMMARY")}
    checked={settings.backgroundVeil}
    enabled={!blank}
    onChange={(value) => (settings.backgroundVeil = value)}
  />
{/snippet}

{#snippet adjustments()}
  <div inert={blank} class="flex flex-col gap-3.5 {blank ? 'opacity-40' : ''}">
    <SelectField
      label={t("BACKGROUND_STYLE")}
      selected={style ?? ""}
      shown={style ? null : t("BACKGROUND_CUSTOM")}
      options={STYLES.map((name) => ({ value: name, label: t(BACKGROUND_STYLE_LABELS[name]) }))}
      onSelect={(value) => edit(BACKGROUND_STYLES[value as BackgroundStyle])}
    />
    {#each SLIDERS as entry (entry.field)}
      {@render slider(entry.field, entry.label)}
    {/each}
    {#if chatBackground.isImage(current)}
      <SelectField
        label={t("BACKGROUND_FIT")}
        selected={effects.fit}
        options={BACKGROUND_FITS.map((fit) => ({ value: fit, label: t(FIT_LABELS[fit]) }))}
        onSelect={(value) => edit({ fit: value as BackgroundFit })}
      />
      {#if effects.fit === "cover"}
        {#each POSITIONS as entry (entry.field)}
          {@render slider(entry.field, entry.label)}
        {/each}
      {/if}
    {/if}
  </div>
{/snippet}

{#snippet panel()}
  <div class="shrink-0 px-5">
    <SegmentedButtons options={TABS.map((key) => t(key))} selected={tab} onSelect={(index) => (tab = index)} fill />
  </div>
  <TabPager selected={tab} onSelect={(index) => (tab = index)} class="mt-3 min-h-0">
    <div use:viewportScrollbar class="{TAB_PAGE_CLASS} {DIALOG_PAGE_CLASS} gap-3.5">
      {@render choices()}
    </div>
    <div use:viewportScrollbar class="{TAB_PAGE_CLASS} {DIALOG_PAGE_CLASS} gap-3.5">
      {@render adjustments()}
    </div>
  </TabPager>
{/snippet}

<CompactDialog title={t("CHAT_BACKGROUND")} {onDismiss} paged>
  {#snippet buttons()}
    {#if chatBackground.isUpload(current)}
      <Button onclick={() => void removeUpload()} variant="danger">{t("BACKGROUND_REMOVE")}</Button>
    {/if}
    <Button onclick={reset} enabled={customized} variant="outlined">{t("RESET")}</Button>
    <Button onclick={onDismiss} variant="outlined">{t("CLOSE")}</Button>
  {/snippet}

  {#if layout.mobile}
    <div class="flex shrink-0 flex-col gap-2 px-5 pb-3">
      {@render preview()}
      {@render veil()}
    </div>
    {@render panel()}
  {:else}
    <div class="flex min-h-0">
      <div class="flex w-80 shrink-0 flex-col gap-2 pl-5">
        {@render preview()}
        {@render veil()}
      </div>
      <div class="flex min-w-0 flex-1 flex-col">
        {@render panel()}
      </div>
    </div>
  {/if}
  <input bind:this={picker} type="file" accept="image/*" onchange={(event) => void uploadBackground(event, reveal)} class="hidden" />
</CompactDialog>
