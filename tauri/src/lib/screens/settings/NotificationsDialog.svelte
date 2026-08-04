<script lang="ts">
  import Bell from "@lucide/svelte/icons/bell";
  import CircleQuestionMark from "@lucide/svelte/icons/circle-question-mark";
  import { settings } from "$lib/data/settings.svelte";
  import { t } from "$lib/i18n/index.svelte";
  import Button from "$lib/ui/Button.svelte";
  import CompactDialog from "$lib/ui/CompactDialog.svelte";
  import CompactSwitch from "$lib/ui/CompactSwitch.svelte";
  import PreferenceRow from "$lib/ui/PreferenceRow.svelte";

  interface Props {
    onDismiss: () => void;
  }

  const { onDismiss }: Props = $props();
</script>

<CompactDialog title={t("NOTIFICATIONS")} {onDismiss} padded={false}>
  {#snippet buttons()}
    <Button onclick={onDismiss} variant="outlined">{t("CLOSE")}</Button>
  {/snippet}

  <div class="w-80 max-w-full">
    <PreferenceRow
      icon={CircleQuestionMark}
      title={t("NOTIFY_INTERACTION")}
      onclick={() => (settings.notifyInteraction = !settings.notifyInteraction)}
    >
      {#snippet trailing()}
        <CompactSwitch
          checked={settings.notifyInteraction}
          onCheckedChange={(value) => (settings.notifyInteraction = value)}
        />
      {/snippet}
    </PreferenceRow>
    <PreferenceRow
      icon={Bell}
      title={t("NOTIFY_TASK_DONE")}
      onclick={() => (settings.notifyTaskDone = !settings.notifyTaskDone)}
    >
      {#snippet trailing()}
        <CompactSwitch
          checked={settings.notifyTaskDone}
          onCheckedChange={(value) => (settings.notifyTaskDone = value)}
        />
      {/snippet}
    </PreferenceRow>
  </div>
</CompactDialog>
