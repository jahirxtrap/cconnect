<script lang="ts">
  import ChevronRight from "@lucide/svelte/icons/chevron-right";
  import { claudeStatus } from "$lib/data/claudeStatus.svelte";
  import { serverStatus } from "$lib/data/serverStatus.svelte";
  import { t } from "$lib/i18n/index.svelte";
  import { backend } from "$lib/services/backend.svelte";
  import { entryFor, entryText } from "$lib/screens/settings/settingsIndex";
  import PreferenceRow from "$lib/ui/PreferenceRow.svelte";
  import SettingsGroup from "$lib/ui/SettingsGroup.svelte";
  import TrailingIcon from "$lib/ui/TrailingIcon.svelte";
  import { CLAUDE_ICONS, type ClaudeKind } from "./ClaudeDetail.svelte";

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
    return (entry ? entryText(entry) : "") || pending;
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
  {@render link(t("PLUGINS"), rowSummary("plugins"), "plugins")}
  {@render link(t("SKILLS"), rowSummary("skills"), "skills")}
  {@render link(t("MCP_SERVERS"), rowSummary("mcp"), "mcp")}
  {@render link(t("MARKETPLACES"), rowSummary("marketplaces"), "marketplaces")}
  {@render link(t("MEMORIES"), memoriesSummary, "memories")}
</SettingsGroup>

{#snippet link(title: string, summary: string, kind: ClaudeKind)}
  <PreferenceRow icon={CLAUDE_ICONS[kind]} {title} {summary} {enabled} onclick={() => onOpen(kind)}>
    {#snippet trailing()}
      <TrailingIcon icon={ChevronRight} />
    {/snippet}
  </PreferenceRow>
{/snippet}
