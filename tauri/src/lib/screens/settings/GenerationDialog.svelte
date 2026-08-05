<script lang="ts">
  import { untrack } from "svelte";
  import { t } from "$lib/i18n/index.svelte";
  import type { Capabilities } from "$lib/services/capabilitiesApi";
  import Button from "$lib/ui/Button.svelte";
  import CompactDialog from "$lib/ui/CompactDialog.svelte";
  import CompactSwitch from "$lib/ui/CompactSwitch.svelte";
  import SelectField from "$lib/ui/SelectField.svelte";

  interface Props {
    capabilities: Capabilities;
    model: string;
    effort: string;
    streaming: boolean;
    onConfirm: (model: string, effort: string, streaming: boolean) => void;
    onDismiss: () => void;
  }

  const { capabilities, model, effort, streaming, onConfirm, onDismiss }: Props = $props();

  let selectedModel = $state(untrack(() => model));
  let selectedEffort = $state(untrack(() => effort));
  let streamTokens = $state(untrack(() => streaming));
</script>

<CompactDialog title={t("GENERATION")} {onDismiss}>
  {#snippet buttons()}
    <Button onclick={onDismiss} variant="outlined">{t("CANCEL")}</Button>
    <Button onclick={() => onConfirm(selectedModel, selectedEffort, streamTokens)} variant="filled">
      {t("SAVE")}
    </Button>
  {/snippet}
  <div class="flex flex-col gap-3.5">
    <SelectField
      label={t("MODEL")}
      selected={selectedModel}
      options={capabilities.models.map((item) => ({ value: item.id, label: item.label }))}
      onSelect={(value) => (selectedModel = value)}
    />
    <SelectField
      label={t("EFFORT")}
      selected={selectedEffort}
      options={capabilities.effortLevels.map((value) => ({ value, label: value }))}
      onSelect={(value) => (selectedEffort = value)}
    />
    <button
      type="button"
      onclick={() => (streamTokens = !streamTokens)}
      class="flex w-full cursor-pointer items-center gap-3 py-2 text-left"
    >
      <span class="min-w-0 flex-1">
        <span class="block text-body-md">{t("STREAMING")}</span>
        <span class="block text-body-sm text-on-surface-variant">{t("STREAMING_DESC")}</span>
      </span>
      <CompactSwitch checked={streamTokens} onCheckedChange={(value) => (streamTokens = value)} />
    </button>
  </div>
</CompactDialog>
