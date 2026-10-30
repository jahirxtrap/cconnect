<script lang="ts">
  import { t } from "$lib/i18n/index.svelte";
  import Button from "$lib/ui/Button.svelte";
  import CompactDialog from "$lib/ui/CompactDialog.svelte";
  import ConfirmDialog from "$lib/ui/ConfirmDialog.svelte";
  import RenameDialog from "$lib/ui/RenameDialog.svelte";
  import { sessionTitle, type AgentSessionList } from "./agentSessions.svelte";

  interface Props {
    list: AgentSessionList;
  }

  const { list }: Props = $props();
</script>

{#if list.renaming}
  {@const target = list.renaming}
  <RenameDialog
    initial={target.title ?? ""}
    onConfirm={(title) => void list.rename(target, title)}
    onDismiss={() => (list.renaming = null)}
  />
{/if}

{#if list.deleting}
  {@const target = list.deleting}
  <ConfirmDialog
    title={t("DELETE")}
    text={t("DELETE_CONVERSATION_CONFIRM", sessionTitle(target))}
    confirmLabel={t("DELETE")}
    danger
    onConfirm={() => void list.remove(target)}
    onDismiss={() => (list.deleting = null)}
  />
{/if}

{#if list.failure}
  {@const message = list.failure}
  <CompactDialog title={t("CONNECTION_ERROR")} onDismiss={() => (list.failure = null)}>
    {#snippet buttons()}
      <Button onclick={() => (list.failure = null)}>{t("ACCEPT")}</Button>
    {/snippet}
    <p class="text-body-sm text-on-surface-variant">{message}</p>
  </CompactDialog>
{/if}
