<script lang="ts">
  import GitFork from "@lucide/svelte/icons/git-fork";
  import History from "@lucide/svelte/icons/history";
  import SquarePen from "@lucide/svelte/icons/square-pen";
  import Trash2 from "@lucide/svelte/icons/trash-2";
  import { untrack } from "svelte";
  import { rankLabel } from "$lib/app/commands.svelte";
  import { navigation } from "$lib/app/navigation.svelte";
  import { agentFailureText, type AgentFailure, type AgentSession } from "$lib/data/agentModels";
  import { sessionIdPreview } from "$lib/data/models";
  import { formatRecent } from "$lib/data/time";
  import { t } from "$lib/i18n/index.svelte";
  import { AgentSessionsWatch } from "$lib/services/agentSessionsWatch.svelte";
  import { createAgentsApi } from "$lib/services/agentsApi";
  import PaneHeader from "$lib/screens/chat/PaneHeader.svelte";
  import type { ChatState } from "$lib/screens/chat/state.svelte";
  import Button from "$lib/ui/Button.svelte";
  import CenteredProgress from "$lib/ui/CenteredProgress.svelte";
  import CompactDialog from "$lib/ui/CompactDialog.svelte";
  import ConfirmDialog from "$lib/ui/ConfirmDialog.svelte";
  import ConnectionError from "$lib/ui/ConnectionError.svelte";
  import EmptyState, { NO_RESULTS_ICON } from "$lib/ui/EmptyState.svelte";
  import MenuItem from "$lib/ui/MenuItem.svelte";
  import Pressable from "$lib/ui/Pressable.svelte";
  import RowMenu from "$lib/ui/RowMenu.svelte";
  import { LIST_VIEWPORT_CLASS, viewportScrollbar } from "$lib/ui/scrollbar";
  import SearchBar from "$lib/ui/SearchBar.svelte";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";
  import { agentPane } from "./agentPane.svelte";

  interface Props {
    chat: ChatState;
    focused: boolean;
  }

  const { chat, focused }: Props = $props();

  const watch = new AgentSessionsWatch(() => chat.environment);

  let query = $state("");
  let menuId = $state<string | null>(null);
  let deleting = $state<AgentSession | null>(null);
  let actionError = $state<string | null>(null);

  const api = $derived(createAgentsApi(() => chat.environment));
  const support = $derived(chat.agentState?.sessions ?? null);
  const removable = $derived(!!support && (support.delete || !support.list));
  const forkable = $derived(!!support?.fork);
  const searching = $derived(query.trim().length > 0);

  const titleOf = (session: AgentSession) => session.title ?? sessionIdPreview(session.sessionId);

  const shown = $derived.by(() => {
    const listed = watch.sessions ?? [];
    if (!searching) return listed;
    return listed
      .map((session) => ({ session, rank: rankLabel(titleOf(session), query) }))
      .filter((item) => item.rank >= 0)
      .sort((a, b) => a.rank - b.rank)
      .map((item) => item.session);
  });

  const close = () => (agentPane.history = false);

  const failedWith = (failure: AgentFailure | null) => {
    actionError = failure ? agentFailureText(failure) : t("CONNECTION_ERROR");
  };

  const pick = (session: AgentSession) => {
    close();
    chat.openAgentSession(session.sessionId);
  };

  const fork = async (session: AgentSession) => {
    if (!chat.agent) return;
    const result = await api.fork(chat.agent, chat.cwd, session.sessionId);
    if (!result.ok || !result.value) {
      failedWith(result.failure);
      return;
    }
    close();
    chat.openAgentSession(result.value);
  };

  const remove = async (session: AgentSession) => {
    deleting = null;
    if (!chat.agent) return;
    const result = await api.forget(chat.agent, chat.cwd, session.sessionId);
    if (!result.ok) {
      failedWith(result.failure);
      return;
    }
    if (session.sessionId === chat.sessionId) agentPane.restart(chat);
  };

  $effect(() => {
    watch.connect();
    return () => watch.close();
  });

  $effect(() => {
    const agent = chat.agent;
    const cwd = chat.cwd;
    if (agent) untrack(() => watch.watch(agent, cwd));
  });

  $effect(() =>
    navigation.intercept(() => {
      if (!navigation.chatActive || !focused) return false;
      close();
      return true;
    }),
  );
</script>

{#snippet newChat()}
  <TooltipIconButton
    label={t("NEW_CHAT")}
    onclick={() => {
      close();
      agentPane.restart(chat);
    }}
  >
    <SquarePen />
  </TooltipIconButton>
{/snippet}

<div class="absolute inset-0 z-10 flex flex-col bg-background">
  <PaneHeader title={t("CHATS")} onBack={close} actions={newChat} />

  {#if watch.sessions?.length}
    <SearchBar value={query} oninput={(value) => (query = value)} placeholder={t("SEARCH")} class="mx-2 mb-1.5" />
  {/if}

  {#if watch.failed}
    <ConnectionError class="min-h-0 flex-1" />
  {:else if !watch.sessions}
    <CenteredProgress class="min-h-0 flex-1" />
  {:else if !shown.length}
    <EmptyState
      icon={searching ? NO_RESULTS_ICON : History}
      text={t(searching ? "NO_RESULTS" : "NO_CHATS")}
      class="min-h-0 flex-1"
    />
  {:else}
    <div
      use:viewportScrollbar
      class="scrollbar-thin flex min-h-0 flex-1 flex-col gap-px overflow-y-auto pb-2 {LIST_VIEWPORT_CLASS}"
    >
      {#each shown as session (session.sessionId)}
        {@const selected = session.sessionId === chat.sessionId}
        <div
          class="group flex shrink-0 items-center rounded-md pr-1.5 transition-colors {selected
            ? 'bg-surface-variant'
            : 'hover:bg-hover'}"
        >
          <Pressable
            onclick={() => pick(session)}
            onlongclick={() => (menuId = session.sessionId)}
            oncontextmenu={() => (menuId = session.sessionId)}
            hover={false}
            class="flex min-w-0 flex-1 flex-col gap-0.5 py-2 pl-2.5"
          >
            <span class="truncate text-body-md {selected ? 'text-on-surface' : 'text-on-surface-variant'}">
              {titleOf(session)}
            </span>
            {#if session.updatedAt !== null}
              <span class="truncate text-caption text-faint">{formatRecent(session.updatedAt)}</span>
            {/if}
          </Pressable>
          {#if forkable || removable}
            <RowMenu
              open={menuId === session.sessionId}
              onOpenChange={(open) => (menuId = open ? session.sessionId : null)}
              shown={selected}
            >
              {#if forkable}
                <MenuItem icon={GitFork} text={t("AGENT_CHAT_FORK")} onclick={() => void fork(session)} />
              {/if}
              {#if removable}
                <MenuItem icon={Trash2} danger text={t("DELETE")} onclick={() => (deleting = session)} />
              {/if}
            </RowMenu>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</div>

{#if deleting}
  {@const target = deleting}
  <ConfirmDialog
    title={t("DELETE")}
    text={t("DELETE_CONVERSATION_CONFIRM", titleOf(target))}
    confirmLabel={t("DELETE")}
    danger
    onConfirm={() => void remove(target)}
    onDismiss={() => (deleting = null)}
  />
{/if}

{#if actionError}
  {@const message = actionError}
  <CompactDialog title={t("CONNECTION_ERROR")} onDismiss={() => (actionError = null)}>
    {#snippet buttons()}
      <Button onclick={() => (actionError = null)}>{t("ACCEPT")}</Button>
    {/snippet}
    <p class="text-body-sm text-on-surface-variant">{message}</p>
  </CompactDialog>
{/if}
