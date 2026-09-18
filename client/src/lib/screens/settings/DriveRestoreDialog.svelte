<script lang="ts">
  import { t } from "$lib/i18n/index.svelte";
  import type { DriveCopy } from "$lib/services/drive/driveApi";
  import Button from "$lib/ui/Button.svelte";
  import CompactDialog from "$lib/ui/CompactDialog.svelte";
  import InputField from "$lib/ui/InputField.svelte";

  interface Props {
    copy: DriveCopy;
    summary: string;
    rejected: boolean;
    onConfirm: (password: string) => void;
    onDismiss: () => void;
  }

  const { copy, summary, rejected, onConfirm, onDismiss }: Props = $props();

  let password = $state("");

  const ready = $derived(!copy.encrypted || password.trim() !== "");
</script>

<CompactDialog title={t("RESTORE")} description={t("DRIVE_RESTORE_CONFIRM", summary)} {onDismiss}>
  {#snippet buttons()}
    <Button onclick={onDismiss} variant="outlined">{t("CANCEL")}</Button>
    <Button enabled={ready} onclick={() => onConfirm(password.trim())}>{t("RESTORE")}</Button>
  {/snippet}

  {#if copy.encrypted}
    <div class="flex flex-col gap-1.5">
      <InputField
        value={password}
        oninput={(value) => (password = value)}
        label={t("DRIVE_PASSWORD_FIELD")}
        error={rejected ? t("DRIVE_PASSWORD_WRONG") : null}
        singleLine
        secret
        autofocus
      />
      <p class="text-body-sm text-on-surface-variant">{t("DRIVE_PASSWORD_ASK_HINT")}</p>
    </div>
  {/if}
</CompactDialog>
