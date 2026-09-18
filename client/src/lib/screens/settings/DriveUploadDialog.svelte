<script lang="ts">
  import { encryptionAvailable } from "$lib/data/backupCrypto";
  import { t } from "$lib/i18n/index.svelte";
  import type { UploadOptions } from "$lib/services/drive/driveBackups.svelte";
  import Button from "$lib/ui/Button.svelte";
  import CompactDialog from "$lib/ui/CompactDialog.svelte";
  import InputField from "$lib/ui/InputField.svelte";
  import SwitchRow from "$lib/ui/SwitchRow.svelte";

  interface Props {
    onUpload: (options: UploadOptions) => void;
    onDismiss: () => void;
  }

  const { onUpload, onDismiss }: Props = $props();

  let notes = $state(true);
  let password = $state("");
</script>

<CompactDialog title={t("DRIVE_UPLOAD")} description={t("EXPORT_SETTINGS_WARNING")} {onDismiss}>
  {#snippet buttons()}
    <Button onclick={onDismiss} variant="outlined">{t("CANCEL")}</Button>
    <Button onclick={() => onUpload({ notes, password: password.trim() })}>{t("DRIVE_UPLOAD")}</Button>
  {/snippet}

  <div class="flex flex-col gap-3.5">
    <SwitchRow
      title={t("INCLUDE_NOTES")}
      summary={t("INCLUDE_NOTES_SUMMARY")}
      checked={notes}
      onChange={(value) => (notes = value)}
    />
    {#if encryptionAvailable()}
      <div class="flex flex-col gap-1.5">
        <InputField
          value={password}
          oninput={(value) => (password = value)}
          label={t("DRIVE_PASSWORD")}
          singleLine
          secret
        />
        <p class="text-body-sm text-on-surface-variant">{t("DRIVE_PASSWORD_HINT")}</p>
      </div>
    {/if}
  </div>
</CompactDialog>
