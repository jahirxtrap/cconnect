<script lang="ts">
  import RotateCw from "@lucide/svelte/icons/rotate-cw";
  import { agentFailureText, type InstalledAgent } from "$lib/data/agentModels";
  import { t } from "$lib/i18n/index.svelte";
  import { createAgentsApi } from "$lib/services/agentsApi";
  import { backend } from "$lib/services/backend.svelte";
  import Button from "$lib/ui/Button.svelte";
  import CompactDialog from "$lib/ui/CompactDialog.svelte";
  import EmptyState from "$lib/ui/EmptyState.svelte";
  import OutputPanel from "$lib/ui/OutputPanel.svelte";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";

  interface Props {
    agent: InstalledAgent;
    onDismiss: () => void;
  }

  const { agent, onDismiss }: Props = $props();

  const api = createAgentsApi(() => backend.active);

  let lines = $state<string[]>([]);
  let loading = $state(true);
  let failed = $state<string | null>(null);

  const load = async () => {
    loading = true;
    failed = null;
    const result = await api.log(agent.id);
    lines = result.ok ? result.value : [];
    if (!result.ok) failed = result.failure ? agentFailureText(result.failure) : t("CONNECTION_ERROR");
    loading = false;
  };

  void load();
</script>

<CompactDialog title={t("AGENT_LOG")} subtitle={agent.name} {onDismiss}>
  {#snippet titleTrailing()}
    <TooltipIconButton label={t("REFRESH")} enabled={!loading} onclick={() => void load()}>
      <RotateCw />
    </TooltipIconButton>
  {/snippet}
  {#snippet buttons()}
    <Button onclick={onDismiss} variant="outlined">{t("CLOSE")}</Button>
  {/snippet}
  {#if !loading && lines.length}
    <OutputPanel text={lines.join("\n")} />
  {:else}
    <EmptyState {loading} text={failed ?? t("AGENT_LOG_EMPTY")} class="h-[72px]" />
  {/if}
</CompactDialog>
