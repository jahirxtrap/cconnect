<script lang="ts">
  import { t } from "$lib/i18n/index.svelte";
  import { cliApi, type CliInfo } from "$lib/services/cliApi";
  import ActionButton from "$lib/ui/ActionButton.svelte";
  import InputField from "$lib/ui/InputField.svelte";
  import SelectField from "$lib/ui/SelectField.svelte";

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

  const labelFor = (value: string) =>
    value === "system"
      ? t("CLI_SOURCE_SYSTEM")
      : value === "custom"
        ? t("CLI_SOURCE_CUSTOM")
        : value === "bundled"
          ? t("CLI_SOURCE_BUNDLED")
          : value;

  const options = $derived(
    info.sources.map((value) => {
      const version = value === "system" ? info.systemVersion : value === "bundled" ? info.bundledVersion : null;
      return { value, label: labelFor(value) + (version ? ` - ${version}` : "") };
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
    />
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
