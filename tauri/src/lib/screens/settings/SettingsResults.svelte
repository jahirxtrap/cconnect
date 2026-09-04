<script lang="ts">
  import { claudeStatus } from "$lib/data/claudeStatus.svelte";
  import { serverSettings } from "$lib/data/serverSettings.svelte";
  import { t } from "$lib/i18n/index.svelte";
  import EmptyState from "$lib/ui/EmptyState.svelte";
  import Pressable from "$lib/ui/Pressable.svelte";
  import SectionHeader from "$lib/ui/SectionHeader.svelte";
  import { entryHint, searchSettings, sectionLabel, type SettingsEntry } from "./settingsIndex";

  interface Props {
    query: string;
    onSelect: (entry: SettingsEntry) => void;
  }

  const { query, onSelect }: Props = $props();

  $effect(() => {
    serverSettings.ensure();
    claudeStatus.ensure();
  });

  const results = $derived(searchSettings(query));

  const grouped = $derived(
    [...new Set(results.map((entry) => entry.section))].map((id) => ({
      section: id,
      entries: results.filter((entry) => entry.section === id),
    })),
  );
</script>

{#each grouped as block, index (block.section)}
  <SectionHeader label={t(sectionLabel(block.section))} divider={index > 0} />
  {#each block.entries as entry (entry.id)}
    {@const hint = entryHint(entry)}
    <Pressable
      onclick={() => onSelect(entry)}
      class="flex w-full flex-col items-start rounded-sm px-2 py-1.5"
    >
      <span class="w-full truncate text-left text-body-md">{t(entry.label)}</span>
      {#if hint}
        <span class="w-full truncate text-left text-body-sm text-on-surface-variant">{hint}</span>
      {/if}
    </Pressable>
  {/each}
{:else}
  <EmptyState text={t("NO_RESULTS")} class="py-8" />
{/each}
