<script lang="ts">
  import { untrack } from "svelte";
  import { t } from "$lib/i18n/index.svelte";
  import Button from "$lib/ui/Button.svelte";
  import CompactDialog from "$lib/ui/CompactDialog.svelte";
  import InputField from "$lib/ui/InputField.svelte";
  import SwitchRow from "$lib/ui/SwitchRow.svelte";

  interface Props {
    persistent: boolean;
    grace: number;
    limit: number;
    reserve: number;
    onConfirm: (persistent: boolean, grace: number, limit: number, reserve: number) => void;
    onDismiss: () => void;
  }

  const { persistent, grace, limit, reserve, onConfirm, onDismiss }: Props = $props();

  const GRACE_MAX = 3600;
  const LIMIT_MAX = 20;
  const RESERVE_MAX = 65536;

  let live = $state(untrack(() => persistent));
  let seconds = $state(untrack(() => String(grace)));
  let count = $state(untrack(() => String(limit)));
  let megabytes = $state(untrack(() => String(reserve)));

  const parsedGrace = $derived(Number(seconds));
  const parsedLimit = $derived(Number(count));
  const parsedReserve = $derived(Number(megabytes));
  const graceValid = $derived(/^\d+$/.test(seconds.trim()) && parsedGrace >= 0 && parsedGrace <= GRACE_MAX);
  const limitValid = $derived(/^\d+$/.test(count.trim()) && parsedLimit >= 1 && parsedLimit <= LIMIT_MAX);
  const reserveValid = $derived(/^\d+$/.test(megabytes.trim()) && parsedReserve >= 0 && parsedReserve <= RESERVE_MAX);
</script>

<CompactDialog title={t("SESSIONS")} {onDismiss}>
  {#snippet buttons()}
    <Button onclick={onDismiss} variant="outlined">{t("CANCEL")}</Button>
    <Button
      enabled={graceValid && limitValid && reserveValid}
      onclick={() => onConfirm(live, parsedGrace, parsedLimit, parsedReserve)}
    >
      {t("SAVE")}
    </Button>
  {/snippet}
  <div class="flex flex-col gap-3.5">
    <SwitchRow
      title={t("PERSISTENT_SESSIONS")}
      summary={t("PERSISTENT_SESSIONS_DESC")}
      checked={live}
      onChange={(checked) => (live = checked)}
    />
    <div class="flex flex-col gap-1.5">
      <InputField
        label={t("SESSION_GRACE")}
        value={seconds}
        numeric
        singleLine
        error={seconds.trim() === "" || graceValid ? null : t("SESSION_GRACE_ERROR", GRACE_MAX)}
        oninput={(value) => (seconds = value)}
      />
      <p class="text-body-sm text-on-surface-variant">{t("SESSION_GRACE_HINT")}</p>
    </div>
    <div class="flex flex-col gap-1.5">
      <InputField
        label={t("SESSION_LIMIT")}
        value={count}
        numeric
        singleLine
        error={count.trim() === "" || limitValid ? null : t("SESSION_LIMIT_ERROR", LIMIT_MAX)}
        oninput={(value) => (count = value)}
      />
      <p class="text-body-sm text-on-surface-variant">{t("SESSION_LIMIT_HINT")}</p>
    </div>
    <div class="flex flex-col gap-1.5">
      <InputField
        label={t("MEMORY_RESERVE")}
        value={megabytes}
        numeric
        singleLine
        error={megabytes.trim() === "" || reserveValid ? null : t("MEMORY_RESERVE_ERROR", RESERVE_MAX)}
        oninput={(value) => (megabytes = value)}
      />
      <p class="text-body-sm text-on-surface-variant">{t("MEMORY_RESERVE_HINT")}</p>
    </div>
  </div>
</CompactDialog>
