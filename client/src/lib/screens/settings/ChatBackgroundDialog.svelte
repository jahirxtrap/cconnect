<script lang="ts">
  import Plus from "@lucide/svelte/icons/plus";
  import X from "@lucide/svelte/icons/x";
  import { untrack } from "svelte";
  import { chatBackground } from "$lib/data/chatBackground.svelte";
  import {
    BACKGROUND_STYLES,
    DEFAULT_BACKGROUND,
    NO_BACKGROUND,
    sameEffects,
    styleOf,
    type BackgroundEffects,
    type BackgroundStyle,
  } from "$lib/design/backgrounds";
  import { packs } from "$lib/design/packs/registry.svelte";
  import { BACKGROUND_FITS, EFFECT_RANGES, type BackgroundFit } from "$lib/design/packs/schema";
  import { t } from "$lib/i18n/index.svelte";
  import ChatBackdrop from "$lib/screens/chat/ChatBackdrop.svelte";
  import ActionButton from "$lib/ui/ActionButton.svelte";
  import Button from "$lib/ui/Button.svelte";
  import CompactDialog from "$lib/ui/CompactDialog.svelte";
  import { FIELD_LABEL_CLASS } from "$lib/ui/field";
  import Pressable from "$lib/ui/Pressable.svelte";
  import SectionHeader from "$lib/ui/SectionHeader.svelte";
  import SelectField from "$lib/ui/SelectField.svelte";
  import Slider from "$lib/ui/Slider.svelte";
  import { BACKGROUND_STYLE_LABELS, backgroundLabel } from "./settingsValues";

  interface Props {
    onDismiss: () => void;
  }

  const { onDismiss }: Props = $props();

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
  const TILE_CLASS = "relative aspect-[3/4] w-full overflow-hidden rounded-lg border-2 bg-background";
  const TILE_IDLE_CLASS = "border-outline-variant enabled:hover:border-outline";
  const TILE_GRID_CLASS = "grid grid-cols-[repeat(auto-fill,minmax(4.5rem,1fr))] gap-2";

  let selected = $state(untrack(() => chatBackground.current));
  let edited = $state<Record<string, BackgroundEffects>>({});
  let picker = $state<HTMLInputElement | null>(null);

  const effectsOf = (id: string) => edited[id] ?? chatBackground.effectsOf(id);
  const effects = $derived(effectsOf(selected));
  const style = $derived(styleOf(effects));
  const customized = $derived(selected !== NO_BACKGROUND && !sameEffects(effects, chatBackground.defaultsOf(selected)));
  const builtinBackgrounds = $derived(packs.all.filter((pack) => pack.builtin).flatMap((pack) => pack.backgrounds));
  const packGroups = $derived(packs.all.filter((pack) => !pack.builtin && pack.backgrounds.length));

  const edit = (patch: Partial<BackgroundEffects>) => {
    edited = { ...edited, [selected]: { ...effects, ...patch } };
  };

  const upload = async (event: Event) => {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = "";
    if (file) selected = await chatBackground.upload(file);
  };

  const removeUpload = async () => {
    const id = selected;
    selected = DEFAULT_BACKGROUND;
    await chatBackground.remove(id);
  };

  const save = () => {
    chatBackground.apply(selected, edited);
    onDismiss();
  };
</script>

{#snippet tile(id: string, caption: string | null)}
  <div class="flex min-w-0 flex-col gap-1">
    <Pressable
      title={backgroundLabel(id)}
      hover={false}
      onclick={() => (selected = id)}
      class="{TILE_CLASS} {selected === id ? 'border-accent' : TILE_IDLE_CLASS}"
    >
      {#if id === NO_BACKGROUND}
        <X size={20} class="absolute inset-0 m-auto text-on-surface-variant" />
      {:else}
        <ChatBackdrop {id} effects={effectsOf(id)} />
      {/if}
    </Pressable>
    {#if caption}
      <p class="truncate text-center text-caption text-on-surface-variant">{caption}</p>
    {/if}
  </div>
{/snippet}

<CompactDialog title={t("CHAT_BACKGROUND")} {onDismiss}>
  {#snippet buttons()}
    <Button
      onclick={() => (edited = { ...edited, [selected]: chatBackground.defaultsOf(selected) })}
      enabled={customized}
      variant="outlined">{t("RESET")}</Button
    >
    <Button onclick={onDismiss} variant="outlined">{t("CANCEL")}</Button>
    <Button onclick={save}>{t("SAVE")}</Button>
  {/snippet}

  <div class="flex w-full flex-col gap-3.5">
    <div class="relative aspect-video w-full overflow-hidden rounded-panel border border-outline-variant bg-background">
      {#if selected !== NO_BACKGROUND}
        <ChatBackdrop id={selected} {effects} />
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
            class="{TILE_CLASS} border-dashed text-on-surface-variant {TILE_IDLE_CLASS}"
          >
            <Plus size={20} class="absolute inset-0 m-auto" />
          </Pressable>
          <p class="truncate text-center text-caption text-on-surface-variant">{t("UPLOAD")}</p>
        </div>
        {#each chatBackground.uploads as id (id)}
          {@render tile(id, null)}
        {/each}
      </div>
    </div>

    {#if selected !== NO_BACKGROUND}
      <div class="flex flex-col gap-3.5">
        <SectionHeader label={t("BACKGROUND_SETTINGS")} />
        <SelectField
          label={t("BACKGROUND_STYLE")}
          selected={style ?? ""}
          shown={style ? null : t("BACKGROUND_CUSTOM")}
          options={STYLES.map((name) => ({ value: name, label: t(BACKGROUND_STYLE_LABELS[name]) }))}
          onSelect={(value) => edit(BACKGROUND_STYLES[value as BackgroundStyle])}
        />
        {#each SLIDERS as slider (slider.field)}
          <div>
            <p class={FIELD_LABEL_CLASS}>{t(slider.label)}</p>
            <Slider
              value={effects[slider.field]}
              min={EFFECT_RANGES[slider.field].min}
              max={EFFECT_RANGES[slider.field].max}
              onChange={(value) => edit({ [slider.field]: value })}
            />
          </div>
        {/each}
        {#if chatBackground.isImage(selected)}
          <SelectField
            label={t("BACKGROUND_FIT")}
            selected={effects.fit}
            options={BACKGROUND_FITS.map((fit) => ({ value: fit, label: t(FIT_LABELS[fit]) }))}
            onSelect={(value) => edit({ fit: value as BackgroundFit })}
          />
          {#if effects.fit === "cover"}
            {#each POSITIONS as position (position.field)}
              <div>
                <p class={FIELD_LABEL_CLASS}>{t(position.label)}</p>
                <Slider
                  value={effects[position.field]}
                  min={EFFECT_RANGES[position.field].min}
                  max={EFFECT_RANGES[position.field].max}
                  onChange={(value) => edit({ [position.field]: value })}
                />
              </div>
            {/each}
          {/if}
        {/if}
        {#if chatBackground.isUpload(selected)}
          <ActionButton text={t("BACKGROUND_REMOVE")} danger onclick={() => void removeUpload()} class="w-full" />
        {/if}
      </div>
    {/if}
  </div>
  <input bind:this={picker} type="file" accept="image/*" onchange={(event) => void upload(event)} class="hidden" />
</CompactDialog>
