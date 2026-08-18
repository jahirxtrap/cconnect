<script lang="ts">
  import { settings } from "$lib/data/settings.svelte";
  import { t } from "$lib/i18n/index.svelte";
  import { notifier } from "$lib/services/notifier.svelte";
  import ActionButton from "$lib/ui/ActionButton.svelte";
  import Button from "$lib/ui/Button.svelte";
  import CompactDialog from "$lib/ui/CompactDialog.svelte";
  import SwitchRow from "$lib/ui/SwitchRow.svelte";

  interface Props {
    onDismiss: () => void;
  }

  const { onDismiss }: Props = $props();
</script>

<CompactDialog title={t("NOTIFICATIONS")} {onDismiss} padded={false}>
  {#snippet buttons()}
    <Button onclick={onDismiss} variant="outlined">{t("CLOSE")}</Button>
  {/snippet}

  <div>
    {#if !notifier.granted}
      <div class="px-5 pb-3">
        <p class="text-body-sm text-on-surface-variant">{t("NOTIFICATIONS_DISABLED_HINT")}</p>
        <ActionButton
          class="mt-2.5 w-full"
          text={t("ENABLE_NOTIFICATIONS")}
          onclick={() => void notifier.requestPermission()}
        />
      </div>
    {/if}
    <div class="px-5">
      <SwitchRow
        title={t("NOTIFY_INTERACTION")}
        summary={t("NOTIFY_INTERACTION_SUMMARY")}
        checked={settings.notifyInteraction}
        enabled={notifier.granted}
        onChange={(value) => (settings.notifyInteraction = value)}
      />
      <SwitchRow
        title={t("NOTIFY_TASK_DONE")}
        summary={t("NOTIFY_TASK_DONE_SUMMARY")}
        checked={settings.notifyTaskDone}
        enabled={notifier.granted}
        onChange={(value) => (settings.notifyTaskDone = value)}
      />
    </div>
  </div>
</CompactDialog>
