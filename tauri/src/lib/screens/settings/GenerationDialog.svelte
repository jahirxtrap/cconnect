<script lang="ts">
  import { untrack } from "svelte";
  import { t } from "$lib/i18n/index.svelte";
  import type { Capabilities } from "$lib/services/capabilitiesApi";
  import Button from "$lib/ui/Button.svelte";
  import CompactDialog from "$lib/ui/CompactDialog.svelte";
  import SwitchRow from "$lib/ui/SwitchRow.svelte";
  import SelectField from "$lib/ui/SelectField.svelte";

  interface Props {
    capabilities: Capabilities;
    model: string;
    effort: string;
    streaming: boolean;
    todoTools: boolean;
    onConfirm: (model: string, effort: string, streaming: boolean, todoTools: boolean) => void;
    onDismiss: () => void;
  }

  const { capabilities, model, effort, streaming, todoTools, onConfirm, onDismiss }: Props = $props();

  let selectedModel = $state(untrack(() => model));
  let selectedEffort = $state(untrack(() => effort));
  let streamTokens = $state(untrack(() => streaming));
  let taskTools = $state(untrack(() => todoTools));
</script>

<CompactDialog title={t("GENERATION")} {onDismiss}>
  {#snippet buttons()}
    <Button onclick={onDismiss} variant="outlined">{t("CANCEL")}</Button>
    <Button onclick={() => onConfirm(selectedModel, selectedEffort, streamTokens, taskTools)}>
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
