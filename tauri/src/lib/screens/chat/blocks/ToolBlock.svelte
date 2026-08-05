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
  }

  const { name, input, result, running }: Props = $props();

</script>

<Collapsible
  label={name ?? t("TOOLS")}
  icon={SquareTerminal}
  preview={input}
  {running}
  labelClass="text-accent"
>
  {#if input.trim()}
    <p class="pt-1 font-mono text-body-sm whitespace-pre-wrap text-on-surface-variant">{input}</p>
  {/if}
  {#if result?.trim()}
    <div class="mt-1.5">
      <CodeBlock code={result} lang={t("RESULT")} />
    </div>
  {/if}
</Collapsible>
