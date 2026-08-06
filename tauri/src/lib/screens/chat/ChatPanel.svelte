<script lang="ts">
  import Activity from "@lucide/svelte/icons/activity";
  import Folder from "@lucide/svelte/icons/folder";
  import Menu from "@lucide/svelte/icons/menu";
  import PanelLeftClose from "@lucide/svelte/icons/panel-left-close";
  import Settings from "@lucide/svelte/icons/settings";
  import SquarePen from "@lucide/svelte/icons/square-pen";
  import SquareTerminal from "@lucide/svelte/icons/square-terminal";
  import Type from "@lucide/svelte/icons/type";
  import { navigation } from "$lib/app/navigation.svelte";
  import type { SessionInfo } from "$lib/data/models";
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
  }

  const { drawerMode, onClose, onAfterSelect, onRename, onColor, onDelete }: Props = $props();

  const chat = $derived(tabs.state);

  let list = $state<HTMLDivElement | null>(null);

  $effect(() => {
    if (chat.historySessions.length && list) list.scrollTop = 0;
  });
</script>

<div class="flex h-full min-h-0 flex-col border-r border-outline-variant bg-surface">
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

  <div class="shrink-0 px-2">
    <ProjectSelector
      projects={chat.historyProjects}
      selected={chat.historyProjectKey}
      onSelect={(projectKey) => chat.selectHistoryProject(projectKey)}
    />
  </div>

  <div bind:this={list} class="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-2 pt-1 pb-2">
    {#if chat.historySessions.length}
      {#each chat.historySessions as session (session.sessionId)}
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
        />
      {/each}
    {:else if chat.historyLoading}
      <CenteredProgress class="h-full" />
    {:else}
      <EmptyState text={t("NO_CHATS")} class="h-full" />
    {/if}
  </div>

  <div class="flex shrink-0 items-center gap-1 border-t border-outline-variant px-2 py-1.5">
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
