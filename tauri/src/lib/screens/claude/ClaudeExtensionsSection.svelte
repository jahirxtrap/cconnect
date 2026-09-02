<script lang="ts">
  import Blocks from "@lucide/svelte/icons/blocks";
  import Brain from "@lucide/svelte/icons/brain";
  import ChevronRight from "@lucide/svelte/icons/chevron-right";
  import Store from "@lucide/svelte/icons/store";
  import Unplug from "@lucide/svelte/icons/unplug";
  import Wand from "@lucide/svelte/icons/wand";
  import { chatListFor } from "$lib/data/chatList.svelte";
  import { projectNameOf } from "$lib/data/models";
  import { t } from "$lib/i18n/index.svelte";
  import { tabs } from "$lib/screens/chat/tabs.svelte";
  import { backend } from "$lib/services/backend.svelte";
  import { claudeApi, type Extensions, type McpServer, type Skill } from "$lib/services/claudeApi";
  import PreferenceRow from "$lib/ui/PreferenceRow.svelte";
  import SettingsGroup from "$lib/ui/SettingsGroup.svelte";
  import type { ClaudeKind } from "./ClaudeDetail.svelte";

  interface Props {
    enabled: boolean;
    pending: string;
    tick?: number;
    onOpen: (kind: ClaudeKind) => void;
  }

  const { enabled, pending, tick = 0, onOpen }: Props = $props();

  let extensions = $state<Extensions | null>(null);
  let skills = $state<Skill[] | null>(null);
  let mcpServers = $state<McpServer[] | null>(null);
  let loaded = $state(false);

  const chat = $derived(tabs.state);
  const projects = $derived(chatListFor(backend.active)?.projects ?? []);
  const memoryProject = $derived(chat.defaultProjectKey(projects) ?? chat.projectKey);

  $effect(() => {
    void tick;
    void backend.activeId;
    void Promise.allSettled([
      claudeApi.extensions().then((value) => (extensions = value)),
      claudeApi.skills().then((value) => (skills = value)),
      claudeApi.mcp().then((value) => (mcpServers = value)),
    ]).then(() => (loaded = true));
  });
</script>

<SettingsGroup label={t("EXTENSIONS")}>
  {@const enabledPlugins = extensions?.plugins.filter((item) => item.enabled).length ?? 0}
  {@render link(
    Blocks,
    t("PLUGINS"),
    extensions ? t("ENABLED_COUNT", enabledPlugins, extensions.plugins.length) : pending,
    "plugins",
  )}
  {@render link(Wand, t("SKILLS"), skills ? String(skills.length) : pending, "skills")}
  {@const enabledServers = mcpServers?.filter((item) => item.enabled).length ?? 0}
  {@render link(
    Unplug,
    t("MCP_SERVERS"),
    mcpServers ? t("ENABLED_COUNT", enabledServers, mcpServers.length) : pending,
    "mcp",
  )}
  {@render link(
    Store,
    t("MARKETPLACES"),
    extensions ? String(extensions.marketplaces.length) : pending,
    "marketplaces",
  )}
  {@render link(
    Brain,
    t("MEMORIES"),
    memoryProject ? projectNameOf(projects, memoryProject, chat.cwd) : loaded ? "—" : pending,
    "memories",
  )}
</SettingsGroup>

{#snippet link(icon: typeof Blocks, title: string, summary: string, kind: ClaudeKind)}
  <PreferenceRow {icon} {title} {summary} {enabled} onclick={() => onOpen(kind)}>
    {#snippet trailing()}
      <ChevronRight size={24} class="text-on-surface-variant" />
    {/snippet}
  </PreferenceRow>
{/snippet}
