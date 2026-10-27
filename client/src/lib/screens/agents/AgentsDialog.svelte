<script lang="ts">
  import Download from "@lucide/svelte/icons/download";
  import RefreshCw from "@lucide/svelte/icons/refresh-cw";
  import Trash from "@lucide/svelte/icons/trash";
  import {
    agentFailureText,
    agentReasonText,
    type AgentFailure,
    type CatalogAgent,
    type InstalledAgent,
  } from "$lib/data/agentModels";
  import { joined } from "$lib/data/format";
  import { KeyGate, keyRefused } from "$lib/data/keyGate.svelte";
  import { t } from "$lib/i18n/index.svelte";
  import { agents } from "$lib/services/agents.svelte";
  import { createAgentsApi } from "$lib/services/agentsApi";
  import { backend } from "$lib/services/backend.svelte";
  import ActionButton from "$lib/ui/ActionButton.svelte";
  import Button from "$lib/ui/Button.svelte";
  import CenteredProgress from "$lib/ui/CenteredProgress.svelte";
  import CompactDialog from "$lib/ui/CompactDialog.svelte";
  import ConfirmDialog from "$lib/ui/ConfirmDialog.svelte";
  import EmptyState from "$lib/ui/EmptyState.svelte";
  import IconTile, { TILE_ICON_SIZE } from "$lib/ui/IconTile.svelte";
  import ListRow from "$lib/ui/ListRow.svelte";
  import LinearProgress from "$lib/ui/LinearProgress.svelte";
  import SectionHeader from "$lib/ui/SectionHeader.svelte";
  import SecurityKeyDialog from "$lib/ui/SecurityKeyDialog.svelte";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";
  import AgentDialog from "./AgentDialog.svelte";
  import AgentIcon from "./AgentIcon.svelte";
  import { AGENT_PROTOCOL_LABELS } from "./agentLabels";

  interface Props {
    onDismiss: () => void;
  }

  const { onDismiss }: Props = $props();

  const api = createAgentsApi(() => backend.active);
  const gate = new KeyGate();

  let catalog = $state<CatalogAgent[] | null>(null);
  let catalogFailed = $state<string | null>(null);
  let failed = $state<string | null>(null);
  let busy = $state(false);
  let editing = $state<InstalledAgent | null>(null);
  let adding = $state(false);
  let removing = $state<InstalledAgent | null>(null);

  const listed = $derived(agents.listOf(backend.active));
  const installed = $derived(listed?.agents ?? []);
  const offered = $derived((catalog ?? []).filter((item) => !item.installed));

  const describe = (failure: AgentFailure | null) => (failure ? agentFailureText(failure) : t("CONNECTION_ERROR"));

  const loadCatalog = async () => {
    const result = await api.catalog();
    if (result.ok) {
      catalog = result.value;
      catalogFailed = null;
    } else catalogFailed = describe(result.failure);
  };

  const refresh = async () => {
    await Promise.all([agents.refresh(backend.active), loadCatalog()]);
  };

  $effect(() => {
    void backend.activeId;
    void refresh();
  });

  const newer = (agent: InstalledAgent): CatalogAgent | null =>
    catalog?.find((item) => item.id === agent.id && item.installed !== null && item.version !== item.installed) ?? null;

  const iconOf = (item: CatalogAgent) => (item.icon ? api.catalogIconUrl(item.icon) : null);

  const act = async (action: (key: string) => Promise<{ ok: boolean; status: number; failure: AgentFailure | null }>) => {
    busy = true;
    failed = null;
    const result = await gate.run(action);
    if (result.ok) await refresh();
    else if (!keyRefused(result)) failed = describe(result.failure);
    busy = false;
  };

  const install = (id: string) => act((key) => api.install(id, key));

  const remove = (agent: InstalledAgent) => {
    removing = null;
    return act((key) => api.remove(agent.id, key));
  };
</script>

{#snippet progress()}
  <LinearProgress />
{/snippet}

<CompactDialog
  title={t("AGENTS")}
  header={busy ? progress : undefined}
  {onDismiss}
>
  {#snippet buttons()}
    <Button onclick={onDismiss} variant="outlined">{t("CLOSE")}</Button>
  {/snippet}
  <div class="flex w-full flex-col [--page-inset:0px]">
    {#if failed}
      <p class="pb-2 text-body-sm wrap-anywhere whitespace-pre-wrap text-error">{failed}</p>
    {/if}
    <SectionHeader label={t("AGENTS_INSTALLED")} />
    {#if !listed}
      <CenteredProgress class="py-3" />
    {:else}
      {#each installed as agent (agent.id)}
        {@const update = newer(agent)}
        <ListRow
          title={agent.name}
          subtitle={joined(
            agent.protocol === "command"
              ? t(AGENT_PROTOCOL_LABELS.command)
              : agent.source === "custom"
                ? t("AGENT_CUSTOM")
                : agent.version && t("VERSION_LABEL", agent.version),
            !agent.enabled && t("AGENT_DISABLED"),
          )}
          dim={!agent.enabled}
          onclick={() => (editing = agent)}
        >
          {#snippet leading()}
            <IconTile>
              <AgentIcon url={agents.iconOf(backend.active, agent.id)} size={TILE_ICON_SIZE} />
            </IconTile>
          {/snippet}
          {#snippet trailing()}
            {#if update}
              <TooltipIconButton label={t("UPDATE_ACTION")} enabled={!busy} onclick={() => void install(agent.id)}>
                <RefreshCw />
              </TooltipIconButton>
            {/if}
            <TooltipIconButton
              label={t(agent.source === "custom" ? "DELETE" : "UNINSTALL")}
              enabled={!busy}
              onclick={() => (removing = agent)}
            >
              <Trash />
            </TooltipIconButton>
          {/snippet}
        </ListRow>
      {:else}
        <EmptyState text={t("AGENTS_NONE")} class="py-3" />
      {/each}
    {/if}
    <div class="mt-1 mb-2">
      <ActionButton text={t("AGENT_ADD")} onclick={() => (adding = true)} class="w-full" />
    </div>
    <SectionHeader label={t("AGENTS_AVAILABLE")} divider />
    {#if catalogFailed}
      <p class="py-2 text-body-sm wrap-anywhere whitespace-pre-wrap text-error">{catalogFailed}</p>
    {:else if !catalog}
      <CenteredProgress class="py-3" />
    {:else}
      {#each offered as item (item.id)}
        <ListRow
          title={item.name}
          subtitle={joined(agentReasonText(item.needs), item.description)}
          subtitleLines={2}
          dim={!item.runnable}
        >
          {#snippet leading()}
            <IconTile>
              <AgentIcon url={iconOf(item)} size={TILE_ICON_SIZE} />
            </IconTile>
          {/snippet}
          {#snippet trailing()}
            <TooltipIconButton
              label={t("INSTALL")}
              enabled={!!item.runnable && !busy}
              onclick={() => void install(item.id)}
            >
              <Download />
            </TooltipIconButton>
          {/snippet}
        </ListRow>
      {:else}
        <EmptyState text={t("AGENTS_AVAILABLE_NONE")} class="py-3" />
      {/each}
    {/if}
  </div>
</CompactDialog>

{#if editing || adding}
  <AgentDialog
    agent={editing}
    {gate}
    onDismiss={() => {
      editing = null;
      adding = false;
    }}
  />
{/if}

{#if removing}
  {@const target = removing}
  <ConfirmDialog
    title={t(target.source === "custom" ? "DELETE" : "UNINSTALL")}
    text={t("AGENT_REMOVE_CONFIRM", target.name)}
    confirmLabel={t(target.source === "custom" ? "DELETE" : "UNINSTALL")}
    danger
    onConfirm={() => void remove(target)}
    onDismiss={() => (removing = null)}
  />
{/if}

{#if gate.asking}
  <SecurityKeyDialog rejected={gate.rejected} onConfirm={(key) => gate.confirm(key)} onDismiss={() => gate.dismiss()} />
{/if}
