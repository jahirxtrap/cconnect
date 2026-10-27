<script lang="ts">
  import { agentFailureText, type InstalledAgent } from "$lib/data/agentModels";
  import { keyRefused, type KeyGate } from "$lib/data/keyGate.svelte";
  import { t } from "$lib/i18n/index.svelte";
  import { createAgentsApi } from "$lib/services/agentsApi";
  import { backend } from "$lib/services/backend.svelte";
  import Button from "$lib/ui/Button.svelte";
  import CenteredProgress from "$lib/ui/CenteredProgress.svelte";
  import CompactDialog from "$lib/ui/CompactDialog.svelte";
  import EmptyState from "$lib/ui/EmptyState.svelte";
  import OutputPanel from "$lib/ui/OutputPanel.svelte";

  interface Props {
    agent: InstalledAgent;
    gate: KeyGate;
    onDismiss: () => void;
  }

  const { agent, gate, onDismiss }: Props = $props();

  const api = createAgentsApi(() => backend.active);

  let lines = $state<string[] | null>(null);
  let failed = $state<string | null>(null);

  const load = async () => {
    const id = agent.id;
    const result = await gate.run((key) => api.log(id, key));
    if (result.ok) lines = result.value;
    else if (keyRefused(result)) onDismiss();
    else failed = result.failure ? agentFailureText(result.failure) : t("CONNECTION_ERROR");
  };

  void load();
</script>

<CompactDialog title={t("AGENT_LOG")} subtitle={agent.name} {onDismiss}>
  {#snippet buttons()}
    <Button onclick={() => void load()} variant="outlined">{t("REFRESH")}</Button>
    <Button onclick={onDismiss}>{t("CLOSE")}</Button>
  {/snippet}
  {#if failed}
    <p class="text-body-sm wrap-anywhere text-error">{failed}</p>
  {:else if lines === null}
    <CenteredProgress class="py-6" />
  {:else if lines.length}
    <OutputPanel text={lines.join("\n")} />
  {:else}
    <EmptyState text={t("AGENT_LOG_EMPTY")} />
  {/if}
</CompactDialog>
