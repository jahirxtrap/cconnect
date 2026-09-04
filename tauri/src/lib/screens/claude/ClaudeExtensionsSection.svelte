<script lang="ts">
  import Blocks from "@lucide/svelte/icons/blocks";
  import Brain from "@lucide/svelte/icons/brain";
  import ChevronRight from "@lucide/svelte/icons/chevron-right";
  import Store from "@lucide/svelte/icons/store";
  import Unplug from "@lucide/svelte/icons/unplug";
  import Wand from "@lucide/svelte/icons/wand";
  import { claudeStatus } from "$lib/data/claudeStatus.svelte";
  import { serverStatus } from "$lib/data/serverStatus.svelte";
  import { t } from "$lib/i18n/index.svelte";
  import { backend } from "$lib/services/backend.svelte";
  import { entryFor, entryHint } from "$lib/screens/settings/settingsIndex";
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

  let loaded = $state(false);

  const rowSummary = (id: string) => {
    const entry = entryFor(id);
    return (entry ? entryHint(entry) : "") || pending;
  };

  const memoriesSummary = $derived(
    rowSummary("memories") === pending && loaded && !serverStatus.unavailable
      ? t("NO_PROJECT")
      : rowSummary("memories"),
  );

  $effect(() => {
    void tick;
    void backend.activeId;
    void claudeStatus.loadExtensions().then(() => (loaded = true));
  });
</script>

<SettingsGroup label={t("EXTENSIONS")}>
  {@render link(Blocks, t("PLUGINS"), rowSummary("plugins"), "plugins")}
  {@render link(Wand, t("SKILLS"), rowSummary("skills"), "skills")}
  {@render link(Unplug, t("MCP_SERVERS"), rowSummary("mcp"), "mcp")}
  {@render link(Store, t("MARKETPLACES"), rowSummary("marketplaces"), "marketplaces")}
  {@render link(Brain, t("MEMORIES"), memoriesSummary, "memories")}
</SettingsGroup>

{#snippet link(icon: typeof Blocks, title: string, summary: string, kind: ClaudeKind)}
  <PreferenceRow {icon} {title} {summary} {enabled} onclick={() => onOpen(kind)}>
    {#snippet trailing()}
      <ChevronRight size={24} class="text-on-surface-variant" />
    {/snippet}
  </PreferenceRow>
{/snippet}
