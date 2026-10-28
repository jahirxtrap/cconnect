<script lang="ts">
  import SquarePen from "@lucide/svelte/icons/square-pen";
  import { navigation } from "$lib/app/navigation.svelte";
  import { settings } from "$lib/data/settings.svelte";
  import { t } from "$lib/i18n/index.svelte";
  import ListTools from "$lib/screens/chat/ListTools.svelte";
  import OrganizeDialog from "$lib/screens/chat/OrganizeDialog.svelte";
  import PaneHeader from "$lib/screens/chat/PaneHeader.svelte";
  import type { ChatState } from "$lib/screens/chat/state.svelte";
  import type { PaneRole } from "$lib/screens/chat/tabs.svelte";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";
  import AgentSessionRows from "./AgentSessionRows.svelte";
  import { AgentSessionList } from "./agentSessions.svelte";
  import { agentTabs } from "./agentTabs.svelte";

  interface Props {
    chat: ChatState;
    focused: boolean;
    role: PaneRole;
  }

  const { chat, focused, role }: Props = $props();

  let organizing = $state(false);

  const close = () => (agentTabs.history[role] = false);

  const folder = $derived(agentTabs.folderOf(chat));

  const list = new AgentSessionList(
    () => chat,
    () => folder,
    () => role,
    close,
  );

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
      agentTabs.restart(chat, folder);
    }}
  >
    <SquarePen />
  </TooltipIconButton>
{/snippet}

<div class="absolute inset-0 z-10 flex flex-col gap-1 bg-background pb-2">
  <PaneHeader title={t("CHATS")} onBack={close} actions={newChat} />
  <ListTools
    {chat}
    query={list.query}
    onQuery={(value) => (list.query = value)}
    projects={chat.historyProjects}
    project={chat.historyProject}
    projectsLoading={chat.historyLoading}
    onProject={(projectKey) => agentTabs.selectProject(chat, projectKey)}
    allProjects={false}
    organizable={!chat.historyUnavailable && !settings.lockedProject}
    onOrganize={() => (organizing = true)}
  />
  <AgentSessionRows {list} {chat} icons />
</div>

{#if organizing}
  <OrganizeDialog {chat} projectsOnly onDismiss={() => (organizing = false)} onOpenChat={() => (organizing = false)} />
{/if}
