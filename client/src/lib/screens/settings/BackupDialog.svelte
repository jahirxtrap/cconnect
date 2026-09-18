<script lang="ts">
  import { exportSettings } from "$lib/data/backup";
  import { t } from "$lib/i18n/index.svelte";
  import { copyText } from "$lib/platform/clipboard";
  import Button from "$lib/ui/Button.svelte";
  import CompactDialog from "$lib/ui/CompactDialog.svelte";
  import InputField from "$lib/ui/InputField.svelte";
  import SwitchRow from "$lib/ui/SwitchRow.svelte";

  interface Props {
    mode: "export" | "import";
    onImport?: (raw: string) => boolean;
    onDismiss: () => void;
  }

  const { mode, onImport, onDismiss }: Props = $props();

  const TITLES = { export: "EXPORT_SETTINGS", import: "IMPORT_SETTINGS" } as const;

  const LINES = 10;

  let draft = $state("");
  let failed = $state(false);
  let notes = $state(false);

  const payload = $derived(mode === "export" ? exportSettings({ notes }) : "");
</script>

<CompactDialog title={t(TITLES[mode])} {onDismiss}>
  {#snippet buttons()}
    {#if mode === "export"}
      <Button onclick={onDismiss} variant="outlined">{t("CANCEL")}</Button>
      <Button onclick={() => void copyText(payload)}>{t("COPY")}</Button>
    {:else}
      <Button onclick={onDismiss} variant="outlined">{t("CANCEL")}</Button>
      <Button
        enabled={!!draft.trim()}
        onclick={() => {
          if (onImport?.(draft.trim())) onDismiss();
          else failed = true;
        }}>{t("ACCEPT")}</Button
      >
    {/if}
  {/snippet}

  <div class="flex w-full flex-col gap-2">
    {#if mode !== "import"}
      <p class="text-body-sm text-on-surface-variant">{t("EXPORT_SETTINGS_WARNING")}</p>
      <SwitchRow title={t("INCLUDE_NOTES")} checked={notes} onChange={(value) => (notes = value)} />
      <InputField value={payload} oninput={() => {}} minLines={LINES} maxLines={LINES} />
    {:else}
      <p class="text-body-sm text-on-surface-variant">{t("IMPORT_SETTINGS_HINT")}</p>
      <InputField
        value={draft}
        oninput={(value) => {
          draft = value;
          failed = false;
        }}
        minLines={LINES}
        maxLines={LINES}
        autofocus
      />
      {#if failed}
        <p class="-mt-0.5 text-body-sm text-red">{t("IMPORT_SETTINGS_FAILED")}</p>
      {/if}
    {/if}
  </div>
</CompactDialog>
