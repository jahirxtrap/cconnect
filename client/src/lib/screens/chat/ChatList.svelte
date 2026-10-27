<script lang="ts">
  import Menu from "@lucide/svelte/icons/menu";
  import PanelLeftClose from "@lucide/svelte/icons/panel-left-close";
  import SquarePen from "@lucide/svelte/icons/square-pen";
  import ChevronDown from "@lucide/svelte/icons/chevron-down";
  import ChevronRight from "@lucide/svelte/icons/chevron-right";
  import Plus from "@lucide/svelte/icons/plus";
  import Settings2 from "@lucide/svelte/icons/settings-2";
  import { rankLabel } from "$lib/app/commands.svelte";
  import { navigation } from "$lib/app/navigation.svelte";
  import ScreenBar from "$lib/app/ScreenBar.svelte";
  import { sessionColorOf } from "$lib/design/sessionColors";
  import { sessionLabel, type ChatCategory, type SessionInfo } from "$lib/data/models";
  import { t } from "$lib/i18n/index.svelte";
  import CenteredProgress from "$lib/ui/CenteredProgress.svelte";
  import EmptyState from "$lib/ui/EmptyState.svelte";
  import ServerUnavailable from "$lib/ui/ServerUnavailable.svelte";
  import { LIST_VIEWPORT_CLASS, viewportScrollbar } from "$lib/ui/scrollbar";
  import SearchBar from "$lib/ui/SearchBar.svelte";
  import { RowDrag } from "$lib/ui/rowDrag.svelte";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";
  import ConversationRow from "./ConversationRow.svelte";
  import { CategoryDrag } from "./dragCategories.svelte";
  import EnvironmentSelector from "./EnvironmentSelector.svelte";
  import ProjectSelector from "./ProjectSelector.svelte";
  import type { ChatState } from "./state.svelte";

  interface Props {
    chat: ChatState;
    drawerMode: boolean;
    onClose: (() => void) | null;
    onAfterSelect: () => void;
    onNewTab: (categoryId: string | null) => void;
    onOpenSession: (session: SessionInfo) => void;
    onOpenRight?: ((session: SessionInfo) => void) | null;
    onRename: (session: SessionInfo) => void;
    onColor: (session: SessionInfo) => void;
    onDelete: (session: SessionInfo) => void;
    onMove: (session: SessionInfo, preset: string | null) => void;
    onNewCategory: (session: SessionInfo) => void;
    onOrganize: () => void;
  }

  const {
    chat,
    drawerMode,
    onClose,
    onAfterSelect,
    onNewTab,
    onOpenSession,
    onOpenRight = null,
    onRename,
    onColor,
    onDelete,
    onMove,
    onNewCategory,
    onOrganize,
  }: Props = $props();

  interface SessionGroup {
    category: ChatCategory | null;
    sessions: SessionInfo[];
  }

  const groups = $derived.by((): SessionGroup[] => {
    const sessions = chat.historySessions;
    if (!chat.historyCategories.length) return [{ category: null, sessions }];
    const manual = chat.chatOrder === "manual";
    const ordered = (list: SessionInfo[]) =>
      manual
        ? [...list].sort(
            (a, b) =>
              (chat.placement[a.sessionId]?.position ?? Number.MAX_VALUE) -
              (chat.placement[b.sessionId]?.position ?? Number.MAX_VALUE),
          )
        : [...list].sort((a, b) => (b.lastActive ?? 0) - (a.lastActive ?? 0));
    const shown = new Set(chat.historyCategories.map((category) => category.id));
    const groupOf = (session: SessionInfo) => {
      const placed = chat.placement[session.sessionId]?.categoryId ?? null;
      return placed !== null && shown.has(placed) ? placed : null;
    };
    const inCategory = (id: string | null) => ordered(sessions.filter((item) => groupOf(item) === id));
    const result: SessionGroup[] = chat.historyCategories
      .filter((category) => !chat.isCategoryHidden(category.id))
      .map((category) => ({ category, sessions: inCategory(category.id) }));
    const loose = inCategory(null);
    return loose.length ? [...result, { category: null, sessions: loose }] : result;
  });

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

  const shownGroups = $derived<SessionGroup[]>(searching ? [{ category: null, sessions: found }] : groups);

  const visibleProjects = $derived(chat.historyProjects);

  let list = $state<HTMLDivElement | null>(null);
  const drag = new RowDrag();
  const categoryDrag = new CategoryDrag();
  let settling = $state(false);

  const startCategoryDrag = (event: PointerEvent, categoryId: string) =>
    categoryDrag.begin(event, categoryId, {
      list,
      onCommit: (moved, beforeId) => {
        const rest = chat.categories.filter((item) => item.id !== moved);
        const at = beforeId === null ? rest.length : rest.findIndex((item) => item.id === beforeId);
        const index = at < 0 ? rest.length : at;
        if (chat.categories.findIndex((item) => item.id === moved) === index) return;
        settling = true;
        chat.reorderCategory(moved, index);
        void chat.commitCategoryOrder(moved);
        requestAnimationFrame(() => requestAnimationFrame(() => (settling = false)));
      },
    });

  const startDrag = (event: PointerEvent, session: SessionInfo, index: number) =>
    drag.begin(event, session.sessionId, {
      list,
      manual: chat.chatOrder === "manual",
      origin: { categoryId: chat.placement[session.sessionId]?.categoryId ?? null, index },
      onExpand: (categoryId) => {
        const category = chat.categories.find((item) => item.id === categoryId);
        if (category && chat.isCategoryCollapsed(categoryId)) chat.toggleCategory(category);
      },
      onCommit: (sessionId, target) => {
        const destination = groups.find((item) => (item.category?.id ?? null) === target.categoryId);
        chat.list?.movePlacement(
          sessionId,
          target.categoryId,
          target.index,
          (destination?.sessions ?? []).map((item) => item.sessionId),
        );
        void chat.placeSession(sessionId, target.categoryId, target.index);
      },
    });

  $effect(() => {
    void chat.historyProject;
    if (list) list.scrollTop = 0;
  });
</script>

<div class="flex h-full min-h-0 flex-col gap-1 bg-surface pt-2.5 pb-2">
  <div class="mb-1 flex shrink-0 items-center px-2">
    <EnvironmentSelector
      class="flex-1"
      selected={chat.environmentId}
      onSelect={(id) => chat.selectEnvironment(id)}
    />
    <TooltipIconButton
      label={t("NEW_SESSION")}
      onclick={() => {
        chat.newSession();
        onAfterSelect();
      }}
    >
      <SquarePen />
    </TooltipIconButton>
    {#if onClose}
      <TooltipIconButton label={t("MENU")} shortcut="panel.left" onclick={onClose}>
        {#if drawerMode}
          <Menu />
        {:else}
          <PanelLeftClose />
        {/if}
      </TooltipIconButton>
    {/if}
  </div>

  <SearchBar value={query} oninput={(value) => (query = value)} placeholder={t("SEARCH")} class="mx-2" />

  <div class="mt-1.5 flex shrink-0 items-center px-2">
    <div class="min-w-0 flex-1">
      <ProjectSelector
        projects={visibleProjects}
        selected={chat.historyProject}
        loading={chat.historyLoading}
        onSelect={(projectKey) => chat.selectHistoryProject(projectKey)}
      />
    </div>
    <TooltipIconButton label={t("ORGANIZE")} enabled={!chat.historyUnavailable} onclick={onOrganize}>
      <Settings2 />
    </TooltipIconButton>
  </div>

  <div
    bind:this={list}
    use:viewportScrollbar
    class="scrollbar-thin flex min-h-0 flex-1 flex-col gap-px overflow-y-auto {LIST_VIEWPORT_CLASS} {drag.active
      ? 'cursor-pointer'
      : ''}"
  >
    {#if searching && !found.length}
      <EmptyState text={t("NO_RESULTS")} class="h-full" />
    {:else if chat.historySessions.length}
      {#each shownGroups as group, groupIndex (group.category?.id ?? "loose")}
        {#if !group.category && groupIndex > 0}
          <div data-spacer={groupIndex} class="my-1 shrink-0">
            <div
              class="mx-2 border-t border-outline-variant"
              style="transform: translateY({drag.shiftFor(`spacer:${groupIndex}`)}px); transition: {drag.active
                ? 'transform 160ms cubic-bezier(0.2, 0, 0, 1)'
                : 'none'}"
            ></div>
          </div>
        {/if}
        {#if group.category}
          {@const category = group.category}
          {@const collapsed = chat.isCategoryCollapsed(category.id)}
          {@const held = categoryDrag.dragging(category.id)}
          {@const joined = held && !collapsed && group.sessions.length > 0}
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div
            data-header={category.id}
            data-collapsed={collapsed}
            class="relative {held ? 'z-10' : ''} {drag.active || categoryDrag.active ? 'pointer-events-none' : ''}"
            onpointerdown={(event) => startCategoryDrag(event, category.id)}
          >
            <div
              data-press
              class="flex h-7 w-full items-center pr-1.5 pl-2.5 transition-colors {joined
                ? 'rounded-t-item'
                : 'rounded-item'} {drag.highlights(category.id)
                ? 'bg-accent-soft outline-2 -outline-offset-2 outline-accent'
                : held
                  ? 'bg-hover'
                  : 'hover:bg-hover'}"
              style="transform: translateY({held
                ? categoryDrag.offset
                : drag.shiftFor(`cat:${category.id}`) + categoryDrag.shiftFor(category.id)}px); transition: {held ||
              settling ||
              (!drag.active && !categoryDrag.active)
                ? 'none'
                : 'transform 160ms cubic-bezier(0.2, 0, 0, 1)'}"
            >
            <button
              type="button"
              class="flex h-full min-w-0 flex-1 cursor-pointer items-center gap-2 text-left"
              onclick={() => chat.toggleCategory(category)}
            >
              <span class="flex size-4 shrink-0 items-center justify-center text-on-surface-variant">
                {#if collapsed}
                  <ChevronRight size={14} />
                {:else}
                  <ChevronDown size={14} />
                {/if}
              </span>
              <span
                class="min-w-0 flex-1 truncate text-label-md"
                style={`color: ${sessionColorOf(category.color) ?? "var(--c-on-surface-variant)"}`}
              >
                {category.name}
              </span>
              <span class="flex size-6 shrink-0 items-center justify-center text-caption text-faint">
                {group.sessions.length}
              </span>
            </button>
            <button
              type="button"
              aria-label={t("NEW_CHAT")}
              class="flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-hover hover:text-on-surface"
              onpointerdown={(event) => event.stopPropagation()}
              onclick={() => {
                onNewTab(category.id);
                onAfterSelect();
              }}
            >
              <Plus size={14} />
            </button>
            </div>
          </div>
        {/if}
        {#if !group.category || !chat.isCategoryCollapsed(group.category.id)}
          {@const groupId = group.category?.id ?? null}
          {#each group.sessions as session, index (session.sessionId)}
            {@const dragged = drag.id === session.sessionId}
            {@const carried = categoryDrag.dragging(groupId)}
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div
              data-row={session.sessionId}
              data-group={groupId ?? ""}
              data-index={index}
              class="relative {dragged || carried ? 'z-10' : ''} {drag.active || categoryDrag.active
                ? 'pointer-events-none'
                : ''}"
              onpointerdown={(event) => !searching && startDrag(event, session, index)}
            >
            <div
              class={dragged
                ? "rounded-item bg-hover"
                : carried
                  ? `bg-hover ${index === group.sessions.length - 1 ? "rounded-b-item" : ""}`
                  : ""}
              style="transform: translateY({dragged
                ? drag.offset
                : carried
                  ? categoryDrag.offset
                  : drag.shiftFor(session.sessionId) + categoryDrag.shiftFor(groupId)}px); transition: {dragged ||
              carried ||
              settling ||
              (!drag.active && !categoryDrag.active)
                ? 'none'
                : 'transform 160ms cubic-bezier(0.2, 0, 0, 1)'}"
            >
            <ConversationRow
              title={sessionLabel(session)}
              selected={navigation.route === "/" && session.sessionId === chat.sessionId}
              color={sessionColorOf(session.color) ?? null}
              onOpen={() => {
                chat.openSession(session);
                onAfterSelect();
              }}
              onRename={() => onRename(session)}
              onAutoRename={() => void chat.autoRename(session)}
              onColor={() => onColor(session)}
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
              onDelete={() => onDelete(session)}
              trash={chat.trashEnabled}
              onMove={(preset) => onMove(session, preset)}
              categories={chat.categoriesFor(session.projectKey)}
              currentCategoryId={chat.placement[session.sessionId]?.categoryId ?? null}
              onPlace={(categoryId) => void chat.placeSession(session.sessionId, categoryId)}
              onNewCategory={() => onNewCategory(session)}
              projects={chat.historyProjects}
              currentProjectKey={session.projectKey}
              activity={session.activity}
              resident={session.resident}
            />
            </div>
            </div>
          {/each}
        {/if}
      {/each}
    {:else if chat.historyLoading}
      <CenteredProgress class="h-full" />
    {:else if chat.historyUnavailable}
      <ServerUnavailable class="h-full" />
    {:else}
      <EmptyState text={t("NO_CHATS")} class="h-full" />
    {/if}
  </div>

  <div class="flex shrink-0 items-center px-2 pt-1.5">
    <ScreenBar />
  </div>
</div>
