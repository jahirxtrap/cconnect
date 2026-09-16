<script lang="ts">
  import SquareTerminal from "@lucide/svelte/icons/square-terminal";
  import { formatDuration } from "$lib/data/format";
  import { t } from "$lib/i18n/index.svelte";
  import CodeBlock from "$lib/ui/CodeBlock.svelte";
  import Collapsible from "./Collapsible.svelte";

  interface Props {
    name: string | null;
    input: string;
    result: string | null;
    running: boolean;
    took?: number | null;
    expanded?: boolean | null;
    onToggle?: (() => void) | null;
  }

  const {
    name,
    input,
    result,
    running,
    took = null,
    expanded = null,
    onToggle = null,
  }: Props = $props();

  const SLOW_MS = 1000;

  const empty = $derived(!input.trim() && !result?.trim());
  const elapsed = $derived(took !== null && took >= SLOW_MS ? formatDuration(took) : null);
</script>

<Collapsible
  label={name ?? t("TOOLS")}
  icon={SquareTerminal}
  preview={input}
  stat={running ? null : elapsed}
  labelOnly={empty}
  {running}
  {expanded}
  {onToggle}
  labelClass="text-accent"
>
  {#if input.trim()}
    <p class="font-mono text-body-sm wrap-anywhere whitespace-pre-wrap text-on-surface-variant">{input}</p>
  {/if}
  {#if result?.trim()}
    <div class="mt-1.5">
      <CodeBlock code={result} lang={t("RESULT")} />
    </div>
  {/if}
</Collapsible>
