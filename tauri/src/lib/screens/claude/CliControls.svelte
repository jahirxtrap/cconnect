<script lang="ts">
  import Folder from "@lucide/svelte/icons/folder";
  import { t } from "$lib/i18n/index.svelte";
  import { cliApi, type CliInfo } from "$lib/services/cliApi";
  import { cliSourceLabel } from "$lib/screens/settings/settingsValues";
  import ActionButton from "$lib/ui/ActionButton.svelte";
  import InputField from "$lib/ui/InputField.svelte";
  import PathPickerDialog from "$lib/ui/PathPickerDialog.svelte";
  import SelectField from "$lib/ui/SelectField.svelte";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";

  interface Props {
    info: CliInfo;
    enabled: boolean;
    onChanged: (info: CliInfo) => void;
  }

  const { info, enabled, onChanged }: Props = $props();

  let source = $state("");
  let customPath = $state("");
  let saving = $state(false);
  let updating = $state(false);
  let browsing = $state(false);

  const pick = () => (browsing = true);

  const options = $derived(
    info.sources.map((value) => {
      const version = value === "system" ? info.systemVersion : value === "bundled" ? info.bundledVersion : null;
      return { value, label: cliSourceLabel(value) + (version ? ` - ${version}` : "") };
    }),
  );

  const dirty = $derived(
    source !== info.source || (source === "custom" && customPath.trim() !== (info.customPath ?? "")),
  );

  const save = async () => {
    saving = true;
    const result = await cliApi.setSource(source, customPath.trim() || null);
    saving = false;
    if (result) onChanged(result);
  };

  const update = async () => {
    updating = true;
    await cliApi.update();
    const result = await cliApi.status();
    updating = false;
    if (result) onChanged(result);
  };

  $effect(() => {
    source = info.source;
    customPath = info.customPath ?? "";
  });
</script>

<div class="flex flex-col gap-2.5 px-4 py-3">
  <SelectField label={t("CLI_SOURCE")} selected={source} {options} onSelect={(value) => (source = value)} />
  {#if source === "custom"}
    <InputField
      value={customPath}
      oninput={(value) => (customPath = value)}
      label={t("CLI_CUSTOM_PATH")}
      singleLine
    >
      {#snippet trailing()}
        <TooltipIconButton label={t("CHOOSE")} onclick={pick} class="size-6 [&_svg]:size-[18px]">
          <Folder />
        </TooltipIconButton>
      {/snippet}
    </InputField>
  {/if}
  {#if dirty}
    <ActionButton
      text={t("SAVE")}
      enabled={enabled && !saving && (source !== "custom" || !!customPath.trim())}
      onclick={() => void save()}
      class="w-full"
    />
  {:else if info.source !== "bundled"}
    <ActionButton
      text={updating ? t("CLI_UPDATING") : t("CLI_UPDATE")}
      enabled={enabled && !updating}
      onclick={() => void update()}
      class="w-full"
    />
  {/if}
</div>

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
