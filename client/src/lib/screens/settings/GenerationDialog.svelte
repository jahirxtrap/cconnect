<script lang="ts">
  import { untrack } from "svelte";
  import { formatTokens } from "$lib/data/format";
  import { t } from "$lib/i18n/index.svelte";
  import { effortLevelsFor, type Capabilities } from "$lib/services/capabilitiesApi";
  import Button from "$lib/ui/Button.svelte";
  import CompactDialog from "$lib/ui/CompactDialog.svelte";
  import InputField from "$lib/ui/InputField.svelte";
  import SwitchRow from "$lib/ui/SwitchRow.svelte";
  import SelectField from "$lib/ui/SelectField.svelte";

  interface Props {
    capabilities: Capabilities;
    model: string;
    effort: string;
    outputStyle: string;
    streaming: boolean;
    todoTools: boolean;
    chatLanguage: string;
    alwaysThinking: boolean;
    autoCompact: boolean;
    autoCompactWindow: number | null;
    compactMin: number | null;
    compactMax: number | null;
    instructionFiles: string | null;
    onConfirm: (values: {
      model: string;
      effort: string;
      outputStyle: string;
      streaming: boolean;
      todoTools: boolean;
      chatLanguage: string;
      alwaysThinking: boolean;
      autoCompact: boolean;
      autoCompactWindow: number | null;
      instructionFiles: string | null;
    }) => void;
    onDismiss: () => void;
  }

  const {
    capabilities,
    model,
    effort,
    outputStyle,
    streaming,
    todoTools,
    chatLanguage,
    alwaysThinking,
    autoCompact,
    autoCompactWindow,
    compactMin,
    compactMax,
    instructionFiles,
    onConfirm,
    onDismiss,
  }: Props = $props();

  const INSTRUCTION_LABELS: Record<string, string> = {
    "": t("OPTION_DEFAULT"),
    "claude-md-and-agents-md": t("INSTRUCTION_FILES_BOTH"),
    "claude-md": t("INSTRUCTION_FILES_CLAUDE"),
  };

  let selectedModel = $state(untrack(() => model));
  let selectedEffort = $state(untrack(() => effort));
  let selectedStyle = $state(untrack(() => outputStyle));
  let streamTokens = $state(untrack(() => streaming));
  let taskTools = $state(untrack(() => todoTools));
  let language = $state(untrack(() => chatLanguage));
  let thinkAlways = $state(untrack(() => alwaysThinking));
  let compactAuto = $state(untrack(() => autoCompact));
  let compactAt = $state(untrack(() => (autoCompactWindow === null ? "" : String(autoCompactWindow))));
  let instructions = $state(untrack(() => instructionFiles ?? ""));

  const windowOptions = $derived.by(() => {
    if (compactMin === null || compactMax === null) return [];
    const steps = Array.from({ length: Math.floor(compactMax / compactMin) }, (_, index) => compactMin * (index + 1));
    const listed = autoCompactWindow === null || steps.includes(autoCompactWindow) ? steps : [...steps, autoCompactWindow];
    return [
      { value: "", label: t("OPTION_DEFAULT") },
      ...listed.sort((a, b) => a - b).map((value) => ({ value: String(value), label: formatTokens(value) })),
    ];
  });

  const instructionOptions = $derived(
    [...new Set([...Object.keys(INSTRUCTION_LABELS), instructionFiles ?? ""])].map((value) => ({
      value,
      label: INSTRUCTION_LABELS[value] ?? value,
    })),
  );

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
    <Button
      onclick={() =>
        onConfirm({
          model: selectedModel,
          effort: selectedEffort,
          outputStyle: selectedStyle,
          streaming: streamTokens,
          todoTools: taskTools,
          chatLanguage: language.trim(),
          alwaysThinking: thinkAlways,
          autoCompact: compactAuto,
          autoCompactWindow: compactAt === "" ? null : Number(compactAt),
          instructionFiles: instructions || null,
        })}
    >
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
    <InputField
      label={t("CHAT_LANGUAGE")}
      value={language}
      placeholder={t("CHAT_LANGUAGE_PLACEHOLDER")}
      singleLine
      oninput={(value) => (language = value)}
      onClear={() => (language = "")}
    />
    {#if instructionFiles !== null}
      <SelectField
        label={t("INSTRUCTION_FILES")}
        selected={instructions}
        options={instructionOptions}
        onSelect={(value) => (instructions = value)}
      />
      <p class="-mt-2.5 text-body-sm text-on-surface-variant">{t("INSTRUCTION_FILES_DESC")}</p>
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
    <SwitchRow
      class="-mt-2"
      title={t("ALWAYS_THINKING")}
      summary={t("ALWAYS_THINKING_DESC")}
      checked={thinkAlways}
      onChange={(value) => (thinkAlways = value)}
    />
    <SwitchRow
      class="-mt-2"
      title={t("AUTO_COMPACT")}
      summary={t("AUTO_COMPACT_DESC")}
      checked={compactAuto}
      onChange={(value) => (compactAuto = value)}
    />
    {#if compactAuto && windowOptions.length}
      <SelectField
        label={t("AUTO_COMPACT_WINDOW")}
        selected={compactAt}
        options={windowOptions}
        onSelect={(value) => (compactAt = value)}
      />
      <p class="-mt-2.5 text-body-sm text-on-surface-variant">{t("AUTO_COMPACT_WINDOW_DESC")}</p>
    {/if}
  </div>
</CompactDialog>
