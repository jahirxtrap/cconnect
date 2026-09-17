<script lang="ts">
  import Archive from "@lucide/svelte/icons/archive";
  import type { CompactData } from "$lib/data/chatModels";
  import { formatTokens, joined } from "$lib/data/format";
  import { t } from "$lib/i18n/index.svelte";
  import MarkdownText from "$lib/ui/MarkdownText.svelte";
  import Collapsible from "./Collapsible.svelte";

  interface Props {
    compact: CompactData;
    expanded?: boolean | null;
    onToggle?: (() => void) | null;
  }

  const { compact, expanded = null, onToggle = null }: Props = $props();

  const hasSummary = $derived(compact.summary.trim().length > 0);

  const stats = $derived.by(() => {
    const parts: string[] = [];
    if (compact.trigger === "manual") parts.push(t("COMPACT_MANUAL"));
    else if (compact.trigger === "auto") parts.push(t("COMPACT_AUTO"));
    if (compact.preTokens !== null && compact.postTokens !== null) {
      parts.push(`${formatTokens(compact.preTokens)} → ${formatTokens(compact.postTokens)}`);
    }
    return joined(...parts);
  });
</script>

<Collapsible
  label={t("COMPACTED")}
  icon={Archive}
  stat={stats}
  labelOnly={!hasSummary}
  labelClass="text-accent"
  bodyClass=""
  {expanded}
  {onToggle}
>
  <MarkdownText text={compact.summary} dense />
</Collapsible>
