<script lang="ts">
  import Archive from "@lucide/svelte/icons/archive";
  import type { CompactData } from "$lib/data/chatModels";
  import { t } from "$lib/i18n/index.svelte";
  import MarkdownText from "$lib/ui/MarkdownText.svelte";
  import Collapsible from "./Collapsible.svelte";

  interface Props {
    compact: CompactData;
  }

  const { compact }: Props = $props();

  const tokens = $derived(
    compact.preTokens !== null && compact.postTokens !== null
      ? `${compact.preTokens} → ${compact.postTokens}`
      : null,
  );

  const label = $derived(tokens ? `${t("COMPACTED")} · ${tokens}` : t("COMPACTED"));
</script>

<Collapsible {label} icon={Archive} labelOnly={!compact.summary.trim()} labelClass="text-accent">
  <MarkdownText text={compact.summary} />
</Collapsible>
