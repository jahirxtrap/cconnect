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
    // A hidden category takes its chats with it: they are not loose, just out of sight.
    const result: SessionGroup[] = chat.categories
      .filter((category) => !chat.isCategoryHidden(category.id))
      .map((category) => ({ category, sessions: inCategory(category.id) }));
    const loose = inCategory(null);
    return loose.length ? [...result, { category: null, sessions: loose }] : result;
  });

  const chat = $derived(tabs.state);

  // The one in front stays listed even when hidden, or the selector would name a project it cannot show.
  const visibleProjects = $derived(
    chat.historyProjects.filter(
      (item) => !chat.isProjectHidden(item.projectKey) || item.projectKey === chat.historyProjectKey,
    ),
  );

  let list = $state<HTMLDivElement | null>(null);

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

  <div bind:this={list} class="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-2 pt-1 pb-2">
    {#if chat.historySessions.length}
      {#each groups as group, groupIndex (group.category?.id ?? "loose")}
        <!-- The loose group has no header of its own, so it needs a line to break from the one above. -->
        {#if !group.category && groupIndex > 0}
          <div class="mx-2 my-1 h-px shrink-0 bg-outline-variant"></div>
        {/if}
        {#if group.category}
          {@const category = group.category}
          {@const collapsed = chat.isCategoryCollapsed(category.id)}
          <div class="flex w-full items-center rounded-item pr-1 transition-colors hover:bg-on-surface/8">
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
              <!-- Shorter than a chat row on purpose: a header, not another entry in the list. -->
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
            <!-- Starts a chat already inside this category. -->
            <button
              type="button"
              aria-label={t("NEW_CHAT")}
              class="flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-on-surface/10"
              onclick={() => {
                tabs.newTab(category.id);
                onAfterSelect();
              }}
            >
              <Plus size={14} />
            </button>
          </div>
        {/if}
        {#if !group.category || !chat.isCategoryCollapsed(group.category.id)}
          {#each group.sessions as session (session.sessionId)}
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
