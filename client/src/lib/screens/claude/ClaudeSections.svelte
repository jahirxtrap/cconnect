<script lang="ts">
  import { t } from "$lib/i18n/index.svelte";
  import { tabs } from "$lib/screens/chat/tabs.svelte";
  import { backend } from "$lib/services/backend.svelte";
  import AccountsSection from "./AccountsSection.svelte";
  import type { ClaudeKind } from "./ClaudeDetail.svelte";
  import ClaudeCliSection from "./ClaudeCliSection.svelte";
  import ClaudeExtensionsSection from "./ClaudeExtensionsSection.svelte";
  import ClaudeStatusSection from "./ClaudeStatusSection.svelte";
  import ClaudeUsageSection from "./ClaudeUsageSection.svelte";

  interface Props {
    tick?: number;
    flashCli?: boolean;
    columns?: number;
    onOpen: (kind: ClaudeKind) => void;
    onAccountsChanged: () => void;
  }

  const { tick = 0, flashCli = false, columns = 1, onOpen, onAccountsChanged }: Props = $props();

  const SECTIONS = ["status", "usage", "accounts", "cli", "extensions"] as const;
  const COLUMN_STARTS: Record<number, number[]> = { 1: [], 2: [3], 3: [3, 4], 4: [2, 3, 4] };

  type Section = (typeof SECTIONS)[number];

  const chat = $derived(tabs.state);
  const serverReady = $derived(backend.configured && chat.connected);
  const pending = $derived(chat.link === "disconnected" ? t("SERVER_UNAVAILABLE") : t("LOADING"));
  const groups = $derived.by(() => {
    const starts = COLUMN_STARTS[columns] ?? COLUMN_STARTS[1];
    return [0, ...starts].map((start, index) => SECTIONS.slice(start, starts[index] ?? SECTIONS.length));
  });
</script>

{#snippet section(name: Section)}
  {#if name === "status"}
    <ClaudeStatusSection enabled={serverReady} {pending} {tick} onOpen={() => onOpen("status")} />
  {:else if name === "usage"}
    <ClaudeUsageSection {tick} {pending} />
  {:else if name === "accounts"}
    <AccountsSection enabled={serverReady} onChanged={onAccountsChanged} />
  {:else if name === "cli"}
    <ClaudeCliSection enabled={serverReady} {tick} {pending} flash={flashCli} />
  {:else}
    <ClaudeExtensionsSection enabled={serverReady} {pending} {tick} {onOpen} />
  {/if}
{/snippet}

{#if groups.length > 1}
  <div class="flex items-start gap-4">
    {#each groups as group, index (index)}
      <div class="flex min-w-0 flex-1 flex-col">
        {#each group as name (name)}
          {@render section(name)}
        {/each}
      </div>
    {/each}
  </div>
{:else}
  {#each SECTIONS as name (name)}
    {@render section(name)}
  {/each}
{/if}
