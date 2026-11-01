<script lang="ts">
  import { untrack } from "svelte";
  import { settings } from "$lib/data/settings.svelte";
  import { t } from "$lib/i18n/index.svelte";
  import { AUTO_READ_MODES, speech } from "$lib/platform/speech.svelte";
  import ActionButton from "$lib/ui/ActionButton.svelte";
  import Button from "$lib/ui/Button.svelte";
  import CompactDialog from "$lib/ui/CompactDialog.svelte";
  import SelectField from "$lib/ui/SelectField.svelte";
  import { autoReadLabel } from "./settingsValues";

  interface Props {
    onDismiss: () => void;
  }

  const { onDismiss }: Props = $props();

  const RATES = [0.75, 1, 1.25, 1.5, 1.75, 2];
  const SAMPLE_KEY = "speech-sample";

  let autoRead = $state(untrack(() => settings.speechAutoRead));
  let voice = $state(untrack(() => settings.speechVoice));
  let rate = $state(untrack(() => settings.speechRate));

  const autoReadOptions = AUTO_READ_MODES.map((value) => ({ value, label: autoReadLabel(value) }));
  const voiceOptions = $derived([
    { value: "", label: t("OPTION_DEFAULT") },
    ...speech.voicesForLanguage().map((item) => ({ value: item.id, label: item.label })),
  ]);
  const rateOptions = RATES.map((value) => ({ value: String(value), label: `${value}×` }));
  const sampling = $derived(speech.speaking === SAMPLE_KEY);

  const close = () => {
    if (sampling) speech.stop();
    onDismiss();
  };

  const save = () => {
    settings.speechAutoRead = autoRead;
    settings.speechVoice = voice;
    settings.speechRate = rate;
    close();
  };
</script>

<CompactDialog title={t("SPEECH")} onDismiss={close}>
  {#snippet buttons()}
    <Button onclick={close} variant="outlined">{t("CANCEL")}</Button>
    <Button onclick={save}>{t("SAVE")}</Button>
  {/snippet}

  <div class="flex flex-col gap-3.5">
    <SelectField
      label={t("SPEECH_AUTO_READ")}
      selected={autoRead}
      options={autoReadOptions}
      onSelect={(value) => (autoRead = value)}
    />
    <p class="-mt-2.5 text-body-sm text-on-surface-variant">{t("SPEECH_AUTO_READ_DESC")}</p>
    <SelectField label={t("SPEECH_VOICE")} selected={voice} options={voiceOptions} onSelect={(value) => (voice = value)} />
    <SelectField
      label={t("SPEECH_RATE")}
      selected={String(rate)}
      options={rateOptions}
      onSelect={(value) => (rate = Number(value))}
    />
    <ActionButton
      class="w-full"
      text={sampling ? t("SPEECH_STOP") : t("SPEECH_TRY")}
      onclick={() => (sampling ? speech.stop() : speech.speakText(SAMPLE_KEY, t("SPEECH_SAMPLE"), { voice, rate }))}
    />
  </div>
</CompactDialog>
