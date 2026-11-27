<script lang="ts">
  import ChevronRight from "@lucide/svelte/icons/chevron-right";
  import { claudeStatus } from "$lib/data/claudeStatus.svelte";
  import { serverSettings } from "$lib/data/serverSettings.svelte";
  import { serverStatus } from "$lib/data/serverStatus.svelte";
  import { t } from "$lib/i18n/index.svelte";
  import { backend } from "$lib/services/backend.svelte";
  import { entryFor, entryText } from "$lib/screens/settings/settingsIndex";
  import PreferenceRow from "$lib/ui/PreferenceRow.svelte";
  import SettingsGroup from "$lib/ui/SettingsGroup.svelte";
  import TrailingIcon from "$lib/ui/TrailingIcon.svelte";
  import { CLAUDE_GROUPS, CLAUDE_ICONS, CLAUDE_TITLES, type ClaudeKind } from "./ClaudeDetail.svelte";

  interface Props {
    enabled: boolean;
    pending: string;
    tick?: number;
    onOpen: (kind: ClaudeKind) => void;
  }

  const { enabled, pending, tick = 0, onOpen }: Props = $props();

  const ENTRY_IDS: Partial<Record<ClaudeKind, string>> = { agents: "claude_agents" };

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

  const summaryOf = (kind: ClaudeKind) => (kind === "memories" ? memoriesSummary : rowSummary(ENTRY_IDS[kind] ?? kind));

  $effect(() => {
    void tick;
    void backend.activeId;
    serverSettings.ensure();
    void claudeStatus.loadExtensions().then(() => (loaded = true));
  });
</script>

{#each CLAUDE_GROUPS as group (group.label)}
  <SettingsGroup label={t(group.label)}>
    {#each group.kinds as kind (kind)}
      <PreferenceRow
        icon={CLAUDE_ICONS[kind]}
        title={t(CLAUDE_TITLES[kind])}
        summary={summaryOf(kind)}
        {enabled}
        onclick={() => onOpen(kind)}
      >
        {#snippet trailing()}
          <TrailingIcon icon={ChevronRight} />
        {/snippet}
      </PreferenceRow>
    {/each}
  </SettingsGroup>
{/each}
