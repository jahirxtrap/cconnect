<script lang="ts">
  import { untrack, type Snippet } from "svelte";
  import BotMessageSquare from "@lucide/svelte/icons/bot-message-square";
  import LogOut from "@lucide/svelte/icons/log-out";
  import Settings2 from "@lucide/svelte/icons/settings-2";
  import { serverStatus } from "$lib/data/serverStatus.svelte";
  import { t } from "$lib/i18n/index.svelte";
  import { agents } from "$lib/services/agents.svelte";
  import { backend } from "$lib/services/backend.svelte";
  import ActionButton from "$lib/ui/ActionButton.svelte";
  import CenteredProgress from "$lib/ui/CenteredProgress.svelte";
  import ConfirmDialog from "$lib/ui/ConfirmDialog.svelte";
  import ConnectionError from "$lib/ui/ConnectionError.svelte";
  import EmptyState from "$lib/ui/EmptyState.svelte";
  import MenuItem from "$lib/ui/MenuItem.svelte";
  import { MENU_ICON_SIZE, menuIconClass } from "$lib/ui/menuSurface";
  import PopupMenu from "$lib/ui/PopupMenu.svelte";
  import ServerUnavailable from "$lib/ui/ServerUnavailable.svelte";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";
  import ChatView from "$lib/screens/chat/ChatView.svelte";
  import PaneHeader from "$lib/screens/chat/PaneHeader.svelte";
  import type { PaneDrag } from "$lib/screens/chat/paneDrag";
  import { panes } from "$lib/screens/chat/panes.svelte";
  import { paneRole } from "$lib/screens/chat/paneSurface";
  import TabStrip from "$lib/screens/chat/TabStrip.svelte";
  import AgentChats from "./AgentChats.svelte";
  import AgentIcon from "./AgentIcon.svelte";
  import AgentsDialog from "./AgentsDialog.svelte";
  import { layout } from "$lib/platform/layout.svelte";
  import { agentTabs } from "./agentTabs.svelte";

  interface Props {
    focused: boolean;
    lead?: Snippet;
    trailing?: Snippet;
    onPaneDrag?: PaneDrag;
    onTabDrag?: (id: string, pointerX: number) => boolean;
  }

  const { focused, lead, trailing, onPaneDrag, onTabDrag }: Props = $props();

  const BUTTON_ICON_SIZE = 18;
  const TAB_ICON_SIZE = 14;

  const role = paneRole() ?? "right";

  let open = $state(false);
  let managing = $state(false);
  let signingOut = $state(false);

  const tab = $derived(agentTabs.activeIn(role));
  const profile = $derived((tab ? backend.find(tab.environmentId) : null) ?? backend.active);
  const listed = $derived(agents.listOf(profile));
  const usable = $derived(agents.usable(profile));
  const selected = $derived(tab ? (usable.find((agent) => agent.id === tab.agent) ?? null) : null);
  const chat = $derived(tab && selected ? agentTabs.stateFor(tab) : null);
  const strip = $derived(agentTabs.in(role).map((item) => ({ id: item.id, title: item.title })));
  const principal = $derived(layout.mobile && role === "center");
  const history = $derived(panes.historyShown(role));
  const iconOf = (id: string) => agents.iconOf(profile, id);

  $effect(() => {
    if (!tab && usable.length) untrack(() => agentTabs.ensure(role));
  });

  $effect(() => {
    const current = tab;
    if (current && listed && !selected && usable.length) untrack(() => agentTabs.setAgent(current, usable[0].id));
  });

  $effect(() => {
    if (!listed && !serverStatus.unavailable) void agents.refresh(profile);
  });
</script>

{#snippet switcher()}
  {#if chat && selected && tab}
    {@const current = tab}
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
            agentTabs.setAgent(current, agent.id);
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

{#snippet tabLeading(id: string)}
  <AgentIcon url={agentTabs.iconOf(id)} size={TAB_ICON_SIZE} class="shrink-0" />
{/snippet}

{#snippet navigation()}
  {@render lead?.()}
  {@render switcher()}
{/snippet}

{#if chat && selected && tab}
  {#if !principal && !history}
    <TabStrip
      items={strip}
      activeId={tab.id}
      onSelect={(id) => agentTabs.select(role, id)}
      onNew={() => agentTabs.newChat(role)}
      onClose={(id) => agentTabs.close(id)}
      onMove={(id, index) => agentTabs.move(id, index)}
      onDrop={() => panes.dropTab()}
      {onPaneDrag}
      {onTabDrag}
      group="agents"
      dot={false}
      leading={tabLeading}
      {focused}
      {lead}
      {trailing}
    />
  {/if}
  <div class="relative flex min-h-0 flex-1 flex-col">
    <ChatView {chat} viewKey={tab.id} {focused} primary={principal} navigationIcon={principal ? navigation : switcher} />
    {#if history}
      <AgentChats {chat} {focused} {role} />
    {/if}
  </div>
{:else}
  <PaneHeader title={t("AGENTS")} leading={lead} />
  {#if serverStatus.unavailable}
    <ServerUnavailable class="min-h-0 flex-1" />
  {:else if !listed && !agents.failed(profile)}
    <CenteredProgress class="min-h-0 flex-1" />
  {:else if !listed}
    <ConnectionError class="min-h-0 flex-1" />
  {:else}
    <EmptyState icon={BotMessageSquare} text={t("AGENTS_NONE")} class="min-h-0 flex-1">
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
