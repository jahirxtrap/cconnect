<script lang="ts">
  import History from "@lucide/svelte/icons/history";
  import { navigation } from "$lib/app/navigation.svelte";
  import { sessionColorOf } from "$lib/design/sessionColors";
  import { sessionLabel, type SessionInfo } from "$lib/data/models";
  import { rankLabel } from "$lib/data/textMatch";
  import { t } from "$lib/i18n/index.svelte";
  import CenteredProgress from "$lib/ui/CenteredProgress.svelte";
  import EmptyState, { NO_RESULTS_ICON } from "$lib/ui/EmptyState.svelte";
  import ServerUnavailable from "$lib/ui/ServerUnavailable.svelte";
  import CategoryGroups from "./CategoryGroups.svelte";
  import type { ChatListEdits } from "./chatListEdits.svelte";
  import ConversationRow from "./ConversationRow.svelte";
  import ListTools from "./ListTools.svelte";
  import type { ChatState } from "./state.svelte";

  interface Props {
    chat: ChatState;
    edits: ChatListEdits;
    onAfterSelect: () => void;
    onNewTab: (categoryId: string | null) => void;
    onOpenSession: (session: SessionInfo) => void;
    onOpenRight: ((session: SessionInfo) => void) | null;
    environmentPicker?: boolean;
  }

  const { chat, edits, onAfterSelect, onNewTab, onOpenSession, onOpenRight, environmentPicker = false }: Props = $props();

  let query = $state("");

  const searching = $derived(query.trim().length > 0);

  const found = $derived.by(() => {
    if (!searching) return [];
    const ranked = chat.historySessions
      .map((session) => ({ session, rank: rankLabel(sessionLabel(session), query) }))
      .filter((item) => item.rank >= 0);
    ranked.sort((a, b) => a.rank - b.rank || (b.session.lastActive ?? 0) - (a.session.lastActive ?? 0));
    return ranked.map((item) => item.session);
  });

  const visibleProjects = $derived(chat.historyProjects);
</script>

<ListTools
  {chat}
  {query}
  onQuery={(value) => (query = value)}
  projects={visibleProjects}
  project={chat.historyProject}
  projectsLoading={chat.historyLoading}
  onProject={(projectKey) => chat.selectHistoryProject(projectKey)}
  organizable={!chat.historyUnavailable}
  onOrganize={() => (edits.organizing = true)}
  environment={environmentPicker
    ? { selected: chat.environmentId, onSelect: (id) => chat.selectEnvironment(id) }
    : null}
/>
<CategoryGroups
  {chat}
  items={searching ? found : chat.historySessions}
  keyOf={(session) => session.sessionId}
  recency={(session) => session.lastActive ?? 0}
  placementOf={(session) => chat.placement[session.sessionId]}
  categories={chat.historyCategories}
  {searching}
  scrollKey={chat.historyProject}
  onMove={(sessionId, categoryId, index, order) => {
    chat.list?.movePlacement(null, sessionId, categoryId, index, order);
    void chat.placeSession(sessionId, categoryId, index);
  }}
  onNewIn={(categoryId) => {
    onNewTab(categoryId);
    onAfterSelect();
  }}
>
  {#snippet row(session, sortable)}
    <ConversationRow
      {sortable}
      title={sessionLabel(session)}
      selected={navigation.route === "/" && session.sessionId === chat.sessionId}
      color={sessionColorOf(session.color) ?? null}
      onOpen={() => {
        chat.openSession(session);
        onAfterSelect();
      }}
      onRename={() => (edits.renaming = session)}
      onAutoRename={() => void chat.autoRename(session)}
      onColor={() => (edits.coloring = session)}
      onOpenNewTab={() => {
        onOpenSession(session);
        onAfterSelect();
      }}
      onOpenRight={onOpenRight
        ? () => {
            onOpenRight(session);
            onAfterSelect();
          }
        : null}
      onFork={() =>
        (edits.forking = {
          session,
          open: (forked) => {
            onOpenSession(forked);
            onAfterSelect();
          },
        })}
      onDelete={() => edits.remove(session)}
      trash={chat.trashEnabled}
      onMove={(preset) => (edits.moving = { session, preset })}
      categories={chat.categoriesFor(session.projectKey)}
      currentCategoryId={chat.placement[session.sessionId]?.categoryId ?? null}
      onPlace={(categoryId) => void chat.placeSession(session.sessionId, categoryId)}
      onNewCategory={() => (edits.categorizing = session)}
      projects={chat.historyProjects}
      currentProjectKey={session.projectKey}
      activity={session.activity}
      resident={session.resident}
    />
  {/snippet}
  {#snippet fallback()}
    {#if searching}
      <EmptyState icon={NO_RESULTS_ICON} text={t("NO_RESULTS")} class="h-full" />
    {:else if chat.historyLoading}
      <CenteredProgress class="h-full" />
    {:else if chat.historyUnavailable}
      <ServerUnavailable class="h-full" />
    {:else}
      <EmptyState icon={History} text={t("NO_CHATS")} class="h-full" />
    {/if}
  {/snippet}
</CategoryGroups>
