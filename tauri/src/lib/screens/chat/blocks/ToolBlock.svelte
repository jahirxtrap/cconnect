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

  const empty = $derived(!input.trim() && !result?.trim());
</script>

<Collapsible
  label={name ?? t("TOOLS")}
  icon={SquareTerminal}
  labelOnly={empty}
  {running}
  labelClass="text-accent"
>
  <div class="flex flex-col gap-1.5">
    {#if input.trim()}
      <CodeBlock code={input} />
    {/if}
    {#if result?.trim()}
      <CodeBlock code={result} />
    {/if}
  </div>
</Collapsible>
