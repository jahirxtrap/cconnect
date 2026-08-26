<script lang="ts">
  import Folder from "@lucide/svelte/icons/folder";
  import { untrack } from "svelte";
  import { t } from "$lib/i18n/index.svelte";
  import { cliApi, type CliInfo } from "$lib/services/cliApi";
  import ActionButton from "$lib/ui/ActionButton.svelte";
  import Button from "$lib/ui/Button.svelte";
  import CompactDialog from "$lib/ui/CompactDialog.svelte";
  import InputField from "$lib/ui/InputField.svelte";
  import PathPickerDialog from "$lib/ui/PathPickerDialog.svelte";
  import SelectField from "$lib/ui/SelectField.svelte";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";

  interface Props {
    info: CliInfo;
    onChanged: (info: CliInfo) => void;
    onDismiss: () => void;
  }

  const { info, onChanged, onDismiss }: Props = $props();

  let source = $state(untrack(() => info.source));
  let customPath = $state(untrack(() => info.customPath ?? ""));
  let updating = $state(false);
  let browsing = $state(false);

  // The CLI runs on the machine hosting the backend, so its path is browsed there.
  const pick = () => (browsing = true);

  const labelFor = (value: string) =>
    value === "system"
      ? t("CLI_SOURCE_SYSTEM")
      : value === "custom"
        ? t("CUSTOM_PATH")
        : value === "bundled"
          ? t("CLI_SOURCE_BUNDLED")
          : value;

  const options = $derived(
    info.sources.map((value) => {
      const version = value === "system" ? info.systemVersion : value === "bundled" ? info.bundledVersion : null;
      return { value, label: labelFor(value) + (version ? ` - ${version}` : "") };
    }),
  );

  const canUpdate = $derived(source !== "bundled");

  const save = async () => {
    const result = await cliApi.setSource(source, customPath.trim() || null);
    if (result) onChanged(result);
    onDismiss();
  };

  const update = async () => {
    updating = true;
    await cliApi.update();
    const result = await cliApi.status();
    updating = false;
    if (result) onChanged(result);
  };
</script>

<CompactDialog title={t("CLI")} {onDismiss}>
  {#snippet buttons()}
    <Button onclick={onDismiss} variant="outlined">{t("CANCEL")}</Button>
    <Button onclick={() => void save()}>{t("SAVE")}</Button>
  {/snippet}
  <SelectField label={t("CLI_SOURCE")} selected={source} {options} onSelect={(value) => (source = value)} />
  {#if source === "custom"}
    <InputField
      value={customPath}
      oninput={(value) => (customPath = value)}
      label={t("CLI_CUSTOM_PATH")}
      singleLine
      class="mt-2.5"
    >
      {#snippet trailing()}
        <TooltipIconButton label={t("CHOOSE")} onclick={pick} class="size-6 [&_svg]:size-[18px]">
          <Folder />
        </TooltipIconButton>
      {/snippet}
    </InputField>
  {/if}
  {#if canUpdate}
    <ActionButton
      text={updating ? t("CLI_UPDATING") : t("CLI_UPDATE")}
      enabled={!updating}
      onclick={() => void update()}
      class="mt-3 w-full"
    />
  {/if}
</CompactDialog>

{#if browsing}
  <PathPickerDialog
    mode="file"
    start={customPath}
    onConfirm={(chosen) => {
      customPath = chosen;
      browsing = false;
    }}
    onDismiss={() => (browsing = false)}
  />
{/if}
