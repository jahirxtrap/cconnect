<script lang="ts">
  import { untrack } from "svelte";
  import { t } from "$lib/i18n/index.svelte";
  import Button from "$lib/ui/Button.svelte";
  import CompactDialog from "$lib/ui/CompactDialog.svelte";
  import InputField from "$lib/ui/InputField.svelte";
  import SwitchRow from "$lib/ui/SwitchRow.svelte";

  interface Props {
    sessions: boolean;
    grace: number;
    limit: number;
    onConfirm: (sessions: boolean, grace: number, limit: number) => void;
    onDismiss: () => void;
  }

  const { sessions, grace, limit, onConfirm, onDismiss }: Props = $props();

  const GRACE_MAX = 3600;
  const LIMIT_MAX = 20;

  let live = $state(untrack(() => sessions));
  let seconds = $state(untrack(() => String(grace)));
  let count = $state(untrack(() => String(limit)));

  const parsedGrace = $derived(Number(seconds));
  const parsedLimit = $derived(Number(count));
  const graceValid = $derived(/^\d+$/.test(seconds.trim()) && parsedGrace >= 0 && parsedGrace <= GRACE_MAX);
  const limitValid = $derived(/^\d+$/.test(count.trim()) && parsedLimit >= 1 && parsedLimit <= LIMIT_MAX);
  const valid = $derived(!live || (graceValid && limitValid));
</script>

<CompactDialog title={t("PERSISTENT_SESSIONS")} {onDismiss}>
  {#snippet buttons()}
    <Button onclick={onDismiss} variant="outlined">{t("CANCEL")}</Button>
    <Button enabled={valid} onclick={() => onConfirm(live, parsedGrace, parsedLimit)}>{t("SAVE")}</Button>
  {/snippet}
  <div class="flex flex-col gap-3.5">
    <SwitchRow
      title={t("PERSISTENT_SESSIONS")}
      summary={t("PERSISTENT_SESSIONS_DESC")}
      checked={live}
      onChange={(checked) => (live = checked)}
    />
    {#if live}
      <div class="flex flex-col gap-1.5">
        <InputField
          label={t("PERSISTENT_GRACE")}
          value={seconds}
          numeric
          singleLine
          error={seconds.trim() === "" || graceValid ? null : t("PERSISTENT_GRACE_ERROR", GRACE_MAX)}
          oninput={(value) => (seconds = value)}
        />
        <p class="text-body-sm text-on-surface-variant">{t("PERSISTENT_GRACE_HINT")}</p>
      </div>
      <div class="flex flex-col gap-1.5">
        <InputField
          label={t("PERSISTENT_LIMIT")}
          value={count}
          numeric
          singleLine
          error={count.trim() === "" || limitValid ? null : t("PERSISTENT_LIMIT_ERROR", LIMIT_MAX)}
          oninput={(value) => (count = value)}
        />
        <p class="text-body-sm text-on-surface-variant">{t("PERSISTENT_LIMIT_HINT")}</p>
      </div>
    {/if}
  </div>
</CompactDialog>
