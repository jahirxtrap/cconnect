<script lang="ts">
  import { settings } from "$lib/data/settings.svelte";
  import { backend } from "$lib/services/backend.svelte";
  import ListTools from "$lib/screens/chat/ListTools.svelte";
  import { panes } from "$lib/screens/chat/panes.svelte";
  import SideList from "$lib/screens/chat/SideList.svelte";
  import type { ChatState } from "$lib/screens/chat/state.svelte";
  import type { PaneRole } from "$lib/screens/chat/tabs.svelte";
  import AgentSessionRows from "./AgentSessionRows.svelte";
  import { AgentSessionList } from "./agentSessions.svelte";
  import { agentTabs } from "./agentTabs.svelte";

  interface Props {
    role: PaneRole;
    drawerMode: boolean;
    onClose: (() => void) | null;
    onAfterSelect: () => void;
    onOrganize: (chat: ChatState) => void;
  }

  const { role, drawerMode, onClose, onAfterSelect, onOrganize }: Props = $props();

  const tab = $derived(agentTabs.activeIn(role));
  const chat = $derived(agentTabs.usableState(tab));
  const folder = $derived(chat ? agentTabs.folderOf(chat) : "");

  const list = new AgentSessionList(
    () => chat,
    () => folder,
    () => role,
    () => onAfterSelect(),
  );
</script>

<SideList
  environmentId={tab?.environmentId ?? backend.activeId}
  onEnvironment={(id) => {
    if (tab) agentTabs.setEnvironment(tab, id);
    else backend.select(id);
  }}
  onNewChat={() => {
    panes.newListChat();
    onAfterSelect();
  }}
  {drawerMode}
  {onClose}
>
  {#snippet tools()}
    <ListTools
      {chat}
      query={list.query}
      onQuery={(value) => (list.query = value)}
      projects={chat?.historyProjects ?? []}
      project={chat?.historyProject ?? null}
      projectsLoading={chat?.historyLoading ?? false}
      onProject={(projectKey) => {
        if (chat) agentTabs.selectProject(chat, projectKey);
      }}
      allProjects={false}
      organizable={!!chat && !chat.historyUnavailable && !settings.lockedProject}
      onOrganize={() => {
        if (chat) onOrganize(chat);
      }}
    />
  {/snippet}
  <AgentSessionRows {list} {chat} />
</SideList>
