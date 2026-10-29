<script lang="ts">
  import { settings } from "$lib/data/settings.svelte";
  import ChatsWindow from "$lib/screens/chat/ChatsWindow.svelte";
  import ListTools from "$lib/screens/chat/ListTools.svelte";
  import OrganizeDialog from "$lib/screens/chat/OrganizeDialog.svelte";
  import { panes } from "$lib/screens/chat/panes.svelte";
  import type { ChatState } from "$lib/screens/chat/state.svelte";
  import type { PaneRole } from "$lib/screens/chat/tabs.svelte";
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

  const close = () => (panes.history[role] = false);

  const folder = $derived(agentTabs.folderOf(chat));

  const list = new AgentSessionList(
    () => chat,
    () => folder,
    () => role,
    close,
  );
</script>

<ChatsWindow {role} {focused} onNewChat={() => agentTabs.restart(chat, folder)}>
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
</ChatsWindow>

{#if organizing}
  <OrganizeDialog {chat} projectsOnly onDismiss={() => (organizing = false)} onOpenChat={() => (organizing = false)} />
{/if}
