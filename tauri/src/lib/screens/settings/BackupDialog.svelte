<script lang="ts">
  import { t } from "$lib/i18n/index.svelte";
  import Button from "$lib/ui/Button.svelte";
  import CompactDialog from "$lib/ui/CompactDialog.svelte";
  import InputField from "$lib/ui/InputField.svelte";

  interface Props {
    mode: "export" | "import";
    payload?: string;
    onImport?: (raw: string) => boolean;
    onDismiss: () => void;
  }

  const { mode, payload = "", onImport, onDismiss }: Props = $props();

  const LINES = 10;

  let draft = $state("");
  let failed = $state(false);
</script>

<CompactDialog title={t(mode === "export" ? "EXPORT_SETTINGS" : "IMPORT_SETTINGS")} {onDismiss}>
  {#snippet buttons()}
    {#if mode === "export"}
      <Button onclick={onDismiss} variant="outlined">{t("CLOSE")}</Button>
      <Button onclick={() => void navigator.clipboard.writeText(payload)}>{t("COPY")}</Button>
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
    {#if mode === "export"}
      <p class="text-body-sm text-on-surface-variant">{t("EXPORT_SETTINGS_WARNING")}</p>
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
