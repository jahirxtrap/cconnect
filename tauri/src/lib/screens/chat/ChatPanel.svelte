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
  import { chatList } from "$lib/data/chatList.svelte";
  import type { SessionInfo } from "$lib/data/models";
  import { t } from "$lib/i18n/index.svelte";
  import CenteredProgress from "$lib/ui/CenteredProgress.svelte";
  import ClaudeIcon from "$lib/ui/ClaudeIcon.svelte";
  import EmptyState from "$lib/ui/EmptyState.svelte";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";
  import ConversationRow from "./ConversationRow.svelte";
  import EnvironmentSelector from "./EnvironmentSelector.svelte";
  import ProjectSelector from "./ProjectSelector.svelte";
  import { chatState } from "./state.svelte";

  interface Props {
    drawerMode: boolean;
    onClose: (() => void) | null;
    onAfterSelect: () => void;
    onRename: (session: SessionInfo) => void;
    onColor: (session: SessionInfo) => void;
    onDelete: (session: SessionInfo) => void;
  }

  const { drawerMode, onClose, onAfterSelect, onRename, onColor, onDelete }: Props = $props();
</script>

<div class="flex h-full min-h-0 flex-col bg-surface">
  <div class="flex h-14 shrink-0 items-center px-2">
    <EnvironmentSelector class="min-w-0 flex-1" />
    <TooltipIconButton
      label={t("NEW_SESSION")}
      onclick={() => {
        chatState.newSession();
        onAfterSelect();
      }}
    >
      <SquarePen size={20} />
    </TooltipIconButton>
    {#if onClose}
      <TooltipIconButton label={t("MENU")} onclick={onClose}>
        {#if drawerMode}
          <Menu size={20} />
        {:else}
          <PanelLeftClose size={20} />
        {/if}
      </TooltipIconButton>
    {/if}
  </div>

  <div class="shrink-0 px-2">
    <ProjectSelector
      selected={chatState.historyProjectKey}
      onSelect={(projectKey) => chatState.selectHistoryProject(projectKey)}
    />
  </div>

  <div class="min-h-0 flex-1 overflow-y-auto py-1.5">
    {#if chatState.historySessions.length}
      {#each chatState.historySessions as session (session.sessionId)}
        <ConversationRow
          title={session.title ?? session.preview ?? session.sessionId.slice(0, 8)}
          selected={session.sessionId === chatState.sessionId}
          onOpen={() => {
            chatState.openSession(session);
            onAfterSelect();
          }}
          onRename={() => onRename(session)}
          onAutoRename={() => void chatState.autoRename(session)}
          onColor={() => onColor(session)}
          onDelete={() => onDelete(session)}
        />
      {/each}
    {:else if chatList.loading}
      <CenteredProgress class="h-full" />
    {:else}
      <EmptyState text={t("NO_CHATS")} class="h-full" />
    {/if}
  </div>

  <div class="flex shrink-0 items-center px-2 py-2">
    <TooltipIconButton label={t("FILES")} onclick={() => navigation.openExplorer()}>
      <Folder size={20} />
    </TooltipIconButton>
    <TooltipIconButton label={t("CLAUDE")} onclick={() => navigation.open("claude")}>
      <ClaudeIcon size={20} />
    </TooltipIconButton>
    <TooltipIconButton label={t("MONITOR")} onclick={() => navigation.open("monitor")}>
      <Activity size={20} />
    </TooltipIconButton>
    <TooltipIconButton label={t("TERMINAL")} onclick={() => navigation.open("terminal")}>
      <SquareTerminal size={20} />
    </TooltipIconButton>
    <TooltipIconButton label={t("MARKDOWN")} onclick={() => navigation.open("markdown")}>
      <Type size={20} />
    </TooltipIconButton>
    <div class="flex-1"></div>
    <TooltipIconButton label={t("SETTINGS")} onclick={() => navigation.openSettings()}>
      <Settings size={20} />
    </TooltipIconButton>
  </div>
</div>
