<script lang="ts">
  import { untrack } from "svelte";
  import { t } from "$lib/i18n/index.svelte";
  import { effortLevelsFor, type Capabilities } from "$lib/services/capabilitiesApi";
  import Button from "$lib/ui/Button.svelte";
  import CompactDialog from "$lib/ui/CompactDialog.svelte";
  import SwitchRow from "$lib/ui/SwitchRow.svelte";
  import SelectField from "$lib/ui/SelectField.svelte";

  interface Props {
    capabilities: Capabilities;
    model: string;
    effort: string;
    outputStyle: string;
    streaming: boolean;
    todoTools: boolean;
    onConfirm: (model: string, effort: string, outputStyle: string, streaming: boolean, todoTools: boolean) => void;
    onDismiss: () => void;
  }

  const { capabilities, model, effort, outputStyle, streaming, todoTools, onConfirm, onDismiss }: Props =
    $props();

  let selectedModel = $state(untrack(() => model));
  let selectedEffort = $state(untrack(() => effort));
  let selectedStyle = $state(untrack(() => outputStyle));
  let streamTokens = $state(untrack(() => streaming));
  let taskTools = $state(untrack(() => todoTools));

  const styleOptions = $derived(capabilities.outputStyles.map((value) => ({ value, label: value })));

  const levels = $derived(effortLevelsFor(capabilities, selectedModel));
  const description = $derived(capabilities.models.find((item) => item.id === selectedModel)?.description ?? "");

  const pickModel = (value: string) => {
    selectedModel = value;
    if (!effortLevelsFor(capabilities, value).includes(selectedEffort)) selectedEffort = "default";
  };
</script>

<CompactDialog title={t("GENERATION")} {onDismiss}>
  {#snippet buttons()}
    <Button onclick={onDismiss} variant="outlined">{t("CANCEL")}</Button>
    <Button onclick={() => onConfirm(selectedModel, selectedEffort, selectedStyle, streamTokens, taskTools)}>
      {t("SAVE")}
    </Button>
  {/snippet}
  <div class="flex flex-col gap-3.5">
    <SelectField
      label={t("MODEL")}
      selected={selectedModel}
      options={capabilities.models.map((item) => ({ value: item.id, label: item.label }))}
      onSelect={pickModel}
    />
    {#if description}
      <p class="-mt-2.5 text-body-sm text-on-surface-variant">{description}</p>
    {/if}
    {#if levels.length}
      <SelectField
        label={t("EFFORT")}
        selected={selectedEffort}
        options={levels.map((value) => ({ value, label: value }))}
        onSelect={(value) => (selectedEffort = value)}
      />
    {/if}
    {#if capabilities.outputStyles.length}
      <SelectField
        label={t("OUTPUT_STYLE")}
        selected={selectedStyle}
        options={styleOptions}
        onSelect={(value) => (selectedStyle = value)}
      />
    {/if}
    {#if capabilities.models.some((item) => item.fastMode)}
      <SwitchRow
        class="-mt-2"
        title={t("FAST_MODE")}
        summary={t("FAST_MODE_DESC")}
        enabled={capabilities.fastMode.disabledReason === null}
        checked={capabilities.fastMode.state === "on"}
        onChange={() => undefined}
      />
    {/if}
    <SwitchRow
      class="-mt-2"
      title={t("STREAMING")}
      summary={t("STREAMING_DESC")}
      checked={streamTokens}
      onChange={(value) => (streamTokens = value)}
    />
    <SwitchRow
      class="-mt-2"
      title={t("TASK_TOOLS")}
      summary={t("TASK_TOOLS_DESC")}
      checked={taskTools}
      onChange={(value) => (taskTools = value)}
    />
  </div>
</CompactDialog>
