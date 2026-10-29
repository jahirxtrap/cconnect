<script lang="ts">
  import History from "@lucide/svelte/icons/history";
  import { t } from "$lib/i18n/index.svelte";
  import ConversationRow from "$lib/screens/chat/ConversationRow.svelte";
  import type { ChatState } from "$lib/screens/chat/state.svelte";
  import CenteredProgress from "$lib/ui/CenteredProgress.svelte";
  import ConnectionError from "$lib/ui/ConnectionError.svelte";
  import EmptyState, { NO_RESULTS_ICON } from "$lib/ui/EmptyState.svelte";
  import { LIST_VIEWPORT_CLASS, viewportScrollbar } from "$lib/ui/scrollbar";
  import AgentSessionDialogs from "./AgentSessionDialogs.svelte";
  import { sessionTitle, type AgentSessionList } from "./agentSessions.svelte";

  interface Props {
    list: AgentSessionList;
    chat: ChatState | null;
    icons?: boolean;
  }

  const { list, chat, icons = false }: Props = $props();
</script>

<div
  use:viewportScrollbar
  class="scrollbar-thin flex min-h-0 flex-1 flex-col gap-px overflow-y-auto {LIST_VIEWPORT_CLASS}"
>
  {#if list.searching && !list.shown.length}
    <EmptyState icon={icons ? NO_RESULTS_ICON : undefined} text={t("NO_RESULTS")} class="h-full" />
  {:else if list.shown.length}
    {#each list.shown as session (session.sessionId)}
      <ConversationRow
        title={sessionTitle(session)}
        selected={session.sessionId === chat?.sessionId}
        activity={session.activity}
        onOpen={() => list.open(session)}
        onOpenNewTab={() => list.openTab(session)}
        onOpenRight={list.rightOpenable ? () => list.openRight(session) : null}
        onFork={list.forkable ? () => void list.fork(session) : null}
        onDelete={list.removable ? () => (list.deleting = session) : null}
      />
    {/each}
  {:else if list.failed}
    <ConnectionError class="h-full" />
  {:else if chat && !list.sessions}
    <CenteredProgress class="h-full" />
  {:else}
    <EmptyState icon={icons ? History : undefined} text={t("NO_CHATS")} class="h-full" />
  {/if}
</div>

<AgentSessionDialogs {list} />
