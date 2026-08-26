<script lang="ts">
  import Activity from "@lucide/svelte/icons/activity";
  import Folder from "@lucide/svelte/icons/folder";
  import Menu from "@lucide/svelte/icons/menu";
  import PanelLeftClose from "@lucide/svelte/icons/panel-left-close";
  import Settings from "@lucide/svelte/icons/settings";
  import SquarePen from "@lucide/svelte/icons/square-pen";
  import SquareTerminal from "@lucide/svelte/icons/square-terminal";
  import Type from "@lucide/svelte/icons/type";
  import ChevronDown from "@lucide/svelte/icons/chevron-down";
  import ChevronRight from "@lucide/svelte/icons/chevron-right";
  import Plus from "@lucide/svelte/icons/plus";
  import Settings2 from "@lucide/svelte/icons/settings-2";
  import { navigation } from "$lib/app/navigation.svelte";
  import { sessionColorOf } from "$lib/design/sessionColors";
  import type { ChatCategory, SessionInfo } from "$lib/data/models";
  import { t } from "$lib/i18n/index.svelte";
  import CenteredProgress from "$lib/ui/CenteredProgress.svelte";
  import ClaudeIcon from "$lib/ui/ClaudeIcon.svelte";
  import EmptyState from "$lib/ui/EmptyState.svelte";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";
  import ConversationRow from "./ConversationRow.svelte";
  import { CategoryDrag } from "./dragCategories.svelte";
  import { ChatDrag } from "./dragChats.svelte";
  import EnvironmentSelector from "./EnvironmentSelector.svelte";
  import ProjectSelector from "./ProjectSelector.svelte";
  import { tabs } from "./tabs.svelte";

  interface Props {
    drawerMode: boolean;
    onClose: (() => void) | null;
    onAfterSelect: () => void;
    onRename: (session: SessionInfo) => void;
    onColor: (session: SessionInfo) => void;
    onDelete: (session: SessionInfo) => void;
    onMove: (session: SessionInfo, preset: string | null) => void;
    onNewCategory: (session: SessionInfo) => void;
    onOrganize: () => void;
  }

  const {
    drawerMode,
    onClose,
    onAfterSelect,
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
    if (!chat.categories.length) return [{ category: null, sessions }];
    const manual = chat.chatOrder === "manual";
    const ordered = (list: SessionInfo[]) =>
      manual
        ? [...list].sort(
            (a, b) =>
              (chat.placement[a.sessionId]?.position ?? Number.MAX_VALUE) -
              (chat.placement[b.sessionId]?.position ?? Number.MAX_VALUE),
          )
        : [...list].sort((a, b) => (b.lastActive ?? 0) - (a.lastActive ?? 0));
    const inCategory = (id: string | null) =>
      ordered(sessions.filter((item) => (chat.placement[item.sessionId]?.categoryId ?? null) === id));
    const result: SessionGroup[] = chat.categories
      .filter((category) => !chat.isCategoryHidden(category.id))
      .map((category) => ({ category, sessions: inCategory(category.id) }));
    const loose = inCategory(null);
    return loose.length ? [...result, { category: null, sessions: loose }] : result;
  });

  const chat = $derived(tabs.state);

  const visibleProjects = $derived(
    chat.historyProjects.filter(
      (item) => !chat.isProjectHidden(item.projectKey) || item.projectKey === chat.historyProjectKey,
    ),
  );

  let list = $state<HTMLDivElement | null>(null);
  const drag = new ChatDrag();
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
    void chat.historyProjectKey;
    if (list) list.scrollTop = 0;
  });
</script>

<div class="flex h-full min-h-0 flex-col bg-surface {drawerMode ? '' : 'border-r border-outline-variant'}">
  <div class="flex h-14 shrink-0 items-center px-2">
    <EnvironmentSelector
      class="min-w-0 flex-1"
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
      <SquarePen size={18} />
    </TooltipIconButton>
    {#if onClose}
      <TooltipIconButton label={t("MENU")} onclick={onClose}>
        {#if drawerMode}
          <Menu size={18} />
        {:else}
          <PanelLeftClose size={18} />
        {/if}
      </TooltipIconButton>
    {/if}
  </div>

  <div class="flex shrink-0 items-center px-2">
    <div class="min-w-0 flex-1">
      <ProjectSelector
        projects={visibleProjects}
        selected={chat.historyProjectKey}
        onSelect={(projectKey) => chat.selectHistoryProject(projectKey)}
      />
    </div>
    <TooltipIconButton label={t("ORGANIZE")} class="size-8 [&_svg]:size-4" onclick={onOrganize}>
      <Settings2 />
    </TooltipIconButton>
  </div>

  <div
    bind:this={list}
    class="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-2 pt-1 pb-2 {drag.active ? 'cursor-pointer' : ''}"
  >
    {#if chat.historySessions.length}
      {#each groups as group, groupIndex (group.category?.id ?? "loose")}
        {#if !group.category && groupIndex > 0}
          <div data-spacer={groupIndex} class="my-1 shrink-0">
            <div
              class="mx-2 h-px bg-outline-variant"
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
              class="flex w-full items-center pr-1 transition-colors {joined
                ? 'rounded-t-item'
                : 'rounded-item'} {drag.highlights(category.id)
                ? 'bg-accent/14 outline-2 -outline-offset-2 outline-accent'
                : held
                  ? 'bg-on-surface/8'
                  : 'hover:bg-on-surface/8'}"
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
              class="flex min-w-0 flex-1 cursor-pointer items-center text-left"
              onclick={() => chat.toggleCategory(category)}
            >
              {#if collapsed}
                <ChevronRight size={14} class="ml-1 shrink-0 text-on-surface-variant" />
              {:else}
                <ChevronDown size={14} class="ml-1 shrink-0 text-on-surface-variant" />
              {/if}
              <span
                class="min-w-0 flex-1 truncate py-1.5 pl-1 text-label-sm uppercase"
                style={`color: ${sessionColorOf(category.color) ?? "var(--c-on-surface-variant)"}`}
              >
                {category.name}
              </span>
              <span class="flex size-6 shrink-0 items-center justify-center text-label-sm text-on-surface-variant">
                {group.sessions.length}
              </span>
            </button>
            <button
              type="button"
              aria-label={t("NEW_CHAT")}
              class="flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-on-surface/10"
              onpointerdown={(event) => event.stopPropagation()}
              onclick={() => {
                tabs.newTab(category.id);
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
            {@const dragged = drag.sessionId === session.sessionId}
            {@const carried = categoryDrag.dragging(groupId)}
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div
              data-session={session.sessionId}
              data-group={groupId ?? ""}
              data-index={index}
              class="relative {dragged || carried ? 'z-10' : ''} {drag.active || categoryDrag.active
                ? 'pointer-events-none'
                : ''}"
              onpointerdown={(event) => startDrag(event, session, index)}
            >
            <div
              class={dragged
                ? "rounded-item bg-on-surface/8"
                : carried
                  ? `bg-on-surface/8 ${index === group.sessions.length - 1 ? "rounded-b-item" : ""}`
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
              title={session.title ?? session.preview ?? session.sessionId.slice(0, 8)}
              selected={session.sessionId === chat.sessionId}
              onOpen={() => {
                chat.openSession(session);
                onAfterSelect();
              }}
              onRename={() => onRename(session)}
              onAutoRename={() => void chat.autoRename(session)}
              onColor={() => onColor(session)}
              onOpenNewTab={() => {
                tabs.openSessionTab(session, tabs.active?.environmentId ?? null);
                onAfterSelect();
              }}
              onDelete={() => onDelete(session)}
              onMove={(preset) => onMove(session, preset)}
              categories={chat.categories}
              currentCategoryId={chat.placement[session.sessionId]?.categoryId ?? null}
              onPlace={(categoryId) => void chat.placeSession(session.sessionId, categoryId)}
              onNewCategory={() => onNewCategory(session)}
              projects={chat.historyProjects}
              currentProjectKey={session.projectKey}
              activity={session.activity}
            />
            </div>
            </div>
          {/each}
        {/if}
      {/each}
    {:else if chat.historyLoading}
      <CenteredProgress class="h-full" />
    {:else}
      <EmptyState text={t("NO_CHATS")} class="h-full" />
    {/if}
  </div>

  <div class="flex shrink-0 items-center border-t border-outline-variant px-2 py-1.5">
    <TooltipIconButton label={t("FILES")} onclick={() => navigation.openExplorer()}>
      <Folder size={17} />
    </TooltipIconButton>
    <TooltipIconButton label={t("CLAUDE")} onclick={() => navigation.navigate("/claude")}>
      <ClaudeIcon size={17} />
    </TooltipIconButton>
    <TooltipIconButton label={t("MONITOR")} onclick={() => navigation.navigate("/monitor")}>
      <Activity size={17} />
    </TooltipIconButton>
    <TooltipIconButton label={t("TERMINAL")} onclick={() => navigation.navigate("/terminal")}>
      <SquareTerminal size={17} />
    </TooltipIconButton>
    <TooltipIconButton label={t("MARKDOWN")} onclick={() => navigation.navigate("/markdown")}>
      <Type size={17} />
    </TooltipIconButton>
    <div class="flex-1"></div>
    <TooltipIconButton label={t("SETTINGS")} onclick={() => navigation.openSettings()}>
      <Settings size={17} />
    </TooltipIconButton>
  </div>
</div>
