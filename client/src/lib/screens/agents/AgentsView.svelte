<script lang="ts">
  import Bot from "@lucide/svelte/icons/bot";
  import LogOut from "@lucide/svelte/icons/log-out";
  import Settings2 from "@lucide/svelte/icons/settings-2";
  import { serverStatus } from "$lib/data/serverStatus.svelte";
  import { t } from "$lib/i18n/index.svelte";
  import { agents } from "$lib/services/agents.svelte";
  import { backend } from "$lib/services/backend.svelte";
  import ActionButton from "$lib/ui/ActionButton.svelte";
  import CenteredProgress from "$lib/ui/CenteredProgress.svelte";
  import ConfirmDialog from "$lib/ui/ConfirmDialog.svelte";
  import EmptyState from "$lib/ui/EmptyState.svelte";
  import MenuItem from "$lib/ui/MenuItem.svelte";
  import { MENU_ICON_SIZE, menuIconClass } from "$lib/ui/menuSurface";
  import PopupMenu from "$lib/ui/PopupMenu.svelte";
  import ServerUnavailable from "$lib/ui/ServerUnavailable.svelte";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";
  import ChatView from "$lib/screens/chat/ChatView.svelte";
  import PaneHeader from "$lib/screens/chat/PaneHeader.svelte";
  import AgentIcon from "./AgentIcon.svelte";
  import AgentsDialog from "./AgentsDialog.svelte";
  import { agentPane } from "./agentPane.svelte";

  interface Props {
    focused: boolean;
  }

  const { focused }: Props = $props();

  const BUTTON_ICON_SIZE = 18;

  let open = $state(false);
  let managing = $state(false);
  let signingOut = $state(false);

  const profile = $derived(backend.active);
  const listed = $derived(agents.listOf(profile));
  const usable = $derived(agents.usable(profile));
  const selected = $derived(usable.find((agent) => agent.id === agentPane.agent) ?? usable[0] ?? null);
  const chat = $derived(selected ? agentPane.stateFor(backend.activeId, selected.id) : null);
  const iconOf = (id: string) => agents.iconOf(profile, id);

  $effect(() => {
    const shown = chat;
    return () => {
      if (shown) agentPane.letGo(shown);
    };
  });
</script>

{#snippet switcher()}
  {#if chat && selected}
    <PopupMenu
      {open}
      label={t("AGENTS")}
      onOpenChange={(value) => {
        open = value;
        if (value) void agents.refresh(profile);
      }}
    >
      {#snippet triggerChild(props)}
        <TooltipIconButton label={t("AGENTS")} {...props}>
          <AgentIcon url={iconOf(selected.id)} size={BUTTON_ICON_SIZE} />
        </TooltipIconButton>
      {/snippet}
      {#each usable as agent (agent.id)}
        <MenuItem
          text={agent.name}
          selected={agent.id === selected.id}
          onclick={() => {
            open = false;
            agentPane.select(agent.id);
          }}
        >
          {#snippet leading()}
            <AgentIcon url={iconOf(agent.id)} size={MENU_ICON_SIZE} class={menuIconClass()} />
          {/snippet}
        </MenuItem>
      {/each}
      {#if chat.agentState?.logout && chat.agentState.status === "ready"}
        <MenuItem
          icon={LogOut}
          text={t("AGENT_SIGN_OUT")}
          onclick={() => {
            open = false;
            signingOut = true;
          }}
        />
      {/if}
      <MenuItem
        icon={Settings2}
        text={t("AGENTS_MANAGE")}
        onclick={() => {
          open = false;
          managing = true;
        }}
      />
    </PopupMenu>
  {/if}
{/snippet}

{#if chat && selected}
  <ChatView {chat} viewKey="{backend.activeId}/{selected.id}" {focused} navigationIcon={switcher} />
{:else}
  <PaneHeader title={t("AGENTS")} />
  {#if serverStatus.unavailable}
    <ServerUnavailable class="min-h-0 flex-1" />
  {:else if !listed}
    <CenteredProgress class="min-h-0 flex-1" />
  {:else}
    <EmptyState icon={Bot} text={t("AGENTS_NONE")} class="min-h-0 flex-1">
      {#snippet action()}
        <ActionButton text={t("AGENTS_MANAGE")} onclick={() => (managing = true)} />
      {/snippet}
    </EmptyState>
  {/if}
{/if}

{#if managing}
  <AgentsDialog onDismiss={() => (managing = false)} />
{/if}

{#if signingOut && chat}
  {@const target = chat}
  <ConfirmDialog
    title={t("AGENT_SIGN_OUT")}
    text={t("AGENT_SIGN_OUT_CONFIRM", target.agentName)}
    confirmLabel={t("AGENT_SIGN_OUT")}
    danger
    onConfirm={() => {
      target.agentLogout();
      signingOut = false;
    }}
    onDismiss={() => (signingOut = false)}
  />
{/if}
