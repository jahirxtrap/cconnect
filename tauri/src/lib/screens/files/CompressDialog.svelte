<script lang="ts">
  import { untrack } from "svelte";
  import { t } from "$lib/i18n/index.svelte";
  import { sharedApi } from "$lib/services/sharedApi";
  import Button from "$lib/ui/Button.svelte";
  import CompactDialog from "$lib/ui/CompactDialog.svelte";
  import InputField from "$lib/ui/InputField.svelte";
  import SelectField from "$lib/ui/SelectField.svelte";

  interface Props {
    defaultName: string;
    onConfirm: (name: string, format: string) => void;
    onDismiss: () => void;
  }

  const { defaultName, onConfirm, onDismiss }: Props = $props();

  let name = $state(untrack(() => defaultName));
  let format = $state("zip");
  let formats = $state(["zip"]);

  $effect(() => {
    void sharedApi.compressFormats().then((result) => {
      if (result?.length) formats = result;
    });
  });
</script>

<CompactDialog title={t("COMPRESS")} {onDismiss}>
  {#snippet buttons()}
    <Button onclick={onDismiss} variant="outlined">{t("CANCEL")}</Button>
    <Button onclick={() => onConfirm(name.trim(), format)} enabled={!!name.trim()}>
      {t("COMPRESS")}
    </Button>
  {/snippet}
  <div class="flex flex-col gap-3">
    <InputField value={name} oninput={(value) => (name = value)} label={t("NAME")} singleLine />
    <SelectField
      label={t("FORMAT")}
      selected={format}
      options={formats.map((value) => ({ value, label: value.toUpperCase() }))}
      onSelect={(value) => (format = value)}
    />
  </div>
</CompactDialog>
