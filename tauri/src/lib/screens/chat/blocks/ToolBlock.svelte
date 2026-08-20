<script lang="ts">
  import SquareTerminal from "@lucide/svelte/icons/square-terminal";
  import { t } from "$lib/i18n/index.svelte";
  import CodeBlock from "$lib/ui/CodeBlock.svelte";
  import Collapsible from "./Collapsible.svelte";

  interface Props {
    name: string | null;
    input: string;
    result: string | null;
    running: boolean;
    expanded?: boolean | null;
    onToggle?: (() => void) | null;
  }

  const { name, input, result, running, expanded = null, onToggle = null }: Props = $props();
</script>

<Collapsible
  label={name ?? t("TOOLS")}
  icon={SquareTerminal}
  preview={input}
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
