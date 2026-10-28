<script lang="ts">
  import TabSwitcher from "$lib/screens/chat/TabSwitcher.svelte";
  import type { PaneRole } from "$lib/screens/chat/tabs.svelte";
  import AgentIcon from "./AgentIcon.svelte";
  import { agentTabs } from "./agentTabs.svelte";

  interface Props {
    role: PaneRole;
  }

  const { role }: Props = $props();

  const ICON_SIZE = 16;

  const shown = $derived(agentTabs.in(role).map((tab) => ({ id: tab.id, title: tab.title })));
</script>

{#snippet icon(id: string)}
  <AgentIcon url={agentTabs.iconOf(id)} size={ICON_SIZE} class="shrink-0" />
{/snippet}

<TabSwitcher
  center={shown}
  right={[]}
  activeId={agentTabs.activeIn(role)?.id ?? null}
  onSelect={(id) => agentTabs.select(role, id)}
  onClose={(id) => agentTabs.close(id)}
  onMove={(id, to) => agentTabs.move(id, to)}
  onNew={() => agentTabs.newChat(role)}
  leading={icon}
/>
