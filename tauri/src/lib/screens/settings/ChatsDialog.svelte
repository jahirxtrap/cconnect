<script lang="ts">
  import { untrack } from "svelte";
  import { t } from "$lib/i18n/index.svelte";
  import Button from "$lib/ui/Button.svelte";
  import CompactDialog from "$lib/ui/CompactDialog.svelte";
  import InputField from "$lib/ui/InputField.svelte";
  import SwitchRow from "$lib/ui/SwitchRow.svelte";

  interface Props {
    trashEnabled: boolean;
    retentionDays: number;
    retentionMin: number;
    retentionMax: number;
    onConfirm: (trashEnabled: boolean, retentionDays: number) => void;
    onDismiss: () => void;
  }

  const { trashEnabled, retentionDays, retentionMin, retentionMax, onConfirm, onDismiss }: Props =
    $props();

  let trash = $state(untrack(() => trashEnabled));
  let days = $state(untrack(() => String(retentionDays)));

  const parsed = $derived(Number(days));
  const valid = $derived(
    /^\d+$/.test(days.trim()) && parsed >= retentionMin && parsed <= retentionMax,
  );
  const error = $derived(
    days.trim() === "" || valid ? null : t("RETENTION_DAYS_ERROR", retentionMin, retentionMax),
  );
</script>

<CompactDialog title={t("CHATS")} {onDismiss}>
  {#snippet buttons()}
    <Button onclick={onDismiss} variant="outlined">{t("CANCEL")}</Button>
    <Button enabled={valid} onclick={() => onConfirm(trash, parsed)}>{t("SAVE")}</Button>
  {/snippet}
  <div class="flex flex-col gap-3.5">
    <SwitchRow
      title={t("TRASH")}
      summary={t("TRASH_HINT")}
      checked={trash}
      onChange={(checked) => (trash = checked)}
    />
    <div class="flex flex-col gap-1.5">
      <InputField
        label={t("RETENTION_DAYS")}
        value={days}
        numeric
        singleLine
        {error}
        oninput={(value) => (days = value)}
      />
      <p class="text-body-sm text-on-surface-variant">{t("RETENTION_DAYS_HINT")}</p>
    </div>
  </div>
</CompactDialog>
