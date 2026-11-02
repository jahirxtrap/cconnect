<script lang="ts">
  import History from "@lucide/svelte/icons/history";
  import KeyRound from "@lucide/svelte/icons/key-round";
  import { t } from "$lib/i18n/index.svelte";
  import CategoryGroups from "$lib/screens/chat/CategoryGroups.svelte";
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
  }

  const { list, chat }: Props = $props();
</script>

{#snippet fallback()}
  {#if list.searching}
    <EmptyState icon={NO_RESULTS_ICON} text={t("NO_RESULTS")} class="h-full" />
  {:else if list.signedOut}
    <EmptyState icon={KeyRound} text={t("AGENT_SIGN_IN_NEEDED")} class="h-full" />
  {:else if list.failed}
    <ConnectionError class="h-full" />
  {:else if chat && !list.sessions}
    <CenteredProgress class="h-full" />
  {:else}
    <EmptyState icon={History} text={t("NO_CHATS")} class="h-full" />
  {/if}
{/snippet}

{#if chat}
  <CategoryGroups
    {chat}
    items={list.shown}
    keyOf={(session) => session.sessionId}
    recency={(session) => session.updatedAt ?? 0}
    placementOf={(session) => list.placementOf(session)}
    categories={list.categories}
    searching={list.searching}
    scrollKey={list.projectKey}
    onMove={(sessionId, categoryId, index, order) => list.move(sessionId, categoryId, index, order)}
    onNewIn={(categoryId) => list.newIn(categoryId)}
    {fallback}
  >
    {#snippet row(session)}
      <ConversationRow
        title={sessionTitle(session)}
        selected={session.sessionId === chat.sessionId}
        activity={session.activity}
        onOpen={() => list.open(session)}
        onOpenNewTab={() => list.openTab(session)}
        onOpenRight={list.rightOpenable ? () => list.openRight(session) : null}
        onRename={() => (list.renaming = session)}
        onFork={list.forkable ? () => (list.forking = session) : null}
        onDelete={list.removable ? () => (list.deleting = session) : null}
        categories={chat.categoriesFor(list.projectKey)}
        currentCategoryId={list.placementOf(session)?.categoryId ?? null}
        onPlace={(categoryId) => list.place(session, categoryId)}
        onNewCategory={() => (list.categorizing = session)}
      />
    {/snippet}
  </CategoryGroups>
{:else}
  <div use:viewportScrollbar class="scrollbar-thin flex min-h-0 flex-1 flex-col gap-px overflow-y-auto {LIST_VIEWPORT_CLASS}">
    {@render fallback()}
  </div>
{/if}

<AgentSessionDialogs {list} />
