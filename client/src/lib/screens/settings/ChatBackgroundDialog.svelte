<script lang="ts">
  import { untrack } from "svelte";
  import { chatBackground } from "$lib/data/chatBackground.svelte";
  import {
    BACKGROUND_STYLES,
    DEFAULT_BACKGROUND,
    sameEffects,
    styleOf,
    type BackgroundEffects,
    type BackgroundStyle,
  } from "$lib/design/backgrounds";
  import { BACKGROUND_FITS, EFFECT_RANGES, type BackgroundFit } from "$lib/design/packs/schema";
  import { t } from "$lib/i18n/index.svelte";
  import ChatBackdrop from "$lib/screens/chat/ChatBackdrop.svelte";
  import ActionButton from "$lib/ui/ActionButton.svelte";
  import Button from "$lib/ui/Button.svelte";
  import CompactDialog from "$lib/ui/CompactDialog.svelte";
  import { FIELD_LABEL_CLASS } from "$lib/ui/field";
  import SelectField from "$lib/ui/SelectField.svelte";
  import Slider from "$lib/ui/Slider.svelte";
  import { BACKGROUND_STYLE_LABELS } from "./settingsValues";

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

  const selected = untrack(() => chatBackground.current);

  let edited = $state<Partial<BackgroundEffects>>({});

  const effects = $derived<BackgroundEffects>({ ...chatBackground.effectsOf(selected), ...edited });
  const style = $derived(styleOf(effects));
  const customized = $derived(!sameEffects(effects, chatBackground.defaultsOf(selected)));

  const edit = (patch: Partial<BackgroundEffects>) => {
    edited = { ...edited, ...patch };
  };

  const removeUpload = async () => {
    await chatBackground.remove(selected);
    chatBackground.apply(DEFAULT_BACKGROUND, {});
    onDismiss();
  };

  const save = () => {
    chatBackground.apply(selected, { [selected]: effects });
    onDismiss();
  };
</script>

<CompactDialog title={t("BACKGROUND_SETTINGS")} {onDismiss}>
  {#snippet buttons()}
    <Button onclick={() => (edited = chatBackground.defaultsOf(selected))} enabled={customized} variant="outlined">
      {t("RESET")}
    </Button>
    <Button onclick={onDismiss} variant="outlined">{t("CANCEL")}</Button>
    <Button onclick={save}>{t("SAVE")}</Button>
  {/snippet}

  <div class="flex w-full flex-col gap-3.5">
    <div class="relative aspect-video w-full overflow-hidden rounded-panel border border-outline-variant bg-background">
      <ChatBackdrop thumbnail id={selected} {effects} />
    </div>
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
</CompactDialog>
