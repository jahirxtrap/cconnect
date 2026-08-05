<script lang="ts">
  import Archive from "@lucide/svelte/icons/archive";
  import ChevronDown from "@lucide/svelte/icons/chevron-down";
  import ChevronRight from "@lucide/svelte/icons/chevron-right";
  import type { CompactData } from "$lib/data/chatModels";
  import { t } from "$lib/i18n/index.svelte";
  import MarkdownText from "$lib/ui/MarkdownText.svelte";

  interface Props {
    compact: CompactData;
    expanded?: boolean | null;
    onToggle?: (() => void) | null;
  }

  const { compact, expanded = null, onToggle = null }: Props = $props();

  const fmtTokens = (n: number) =>
    n >= 1_000_000
      ? `${Math.floor(n / 1_000_000)}M`
      : n >= 1_000
        ? `${Math.floor(n / 1_000)}k`
        : `${n}`;

  const hasSummary = $derived(compact.summary.trim().length > 0);

  const stats = $derived.by(() => {
    const parts: string[] = [];
    if (compact.trigger === "manual") parts.push(t("COMPACT_MANUAL"));
    else if (compact.trigger === "auto") parts.push(t("COMPACT_AUTO"));
    if (compact.preTokens !== null && compact.postTokens !== null) {
      parts.push(`${fmtTokens(compact.preTokens)} → ${fmtTokens(compact.postTokens)}`);
    }
    return parts.join(" • ");
  });

  let localExpanded = $state(false);

  const isExpanded = $derived(expanded ?? localExpanded);

  const toggle = () => {
    if (onToggle) onToggle();
    else localExpanded = !localExpanded;
  };
</script>

<div class="w-full px-4">
  <button
    type="button"
    disabled={!hasSummary}
    onclick={toggle}
    class="flex w-full items-center text-left transition-colors select-none {hasSummary
      ? 'cursor-pointer hover:bg-on-surface/8'
      : 'cursor-default'}"
  >
    <Archive size={16} class="shrink-0 text-accent" />
    <span class="ml-1.5 shrink-0 text-body-md text-accent">{t("COMPACTED")}</span>
    <span class="flex-1"></span>
    {#if stats}
      <span class="truncate text-body-sm text-on-surface-variant">{stats}</span>
    {/if}
    {#if hasSummary}
      {#if isExpanded}
        <ChevronDown size={18} class="ml-1.5 shrink-0 text-on-surface-variant" />
      {:else}
        <ChevronRight size={18} class="ml-1.5 shrink-0 text-on-surface-variant" />
      {/if}
    {/if}
  </button>
  {#if isExpanded && hasSummary}
    <div class="pt-1"><MarkdownText text={compact.summary} /></div>
  {/if}
</div>
