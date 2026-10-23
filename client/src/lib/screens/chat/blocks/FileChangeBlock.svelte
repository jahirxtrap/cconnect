<script lang="ts">
  import FilePen from "@lucide/svelte/icons/file-pen";
  import type { DiffLine } from "$lib/data/chatModels";
  import DiffView from "$lib/ui/DiffView.svelte";
  import Collapsible from "./Collapsible.svelte";

  interface Props {
    path: string;
    tool?: string | null;
    diffLines: DiffLine[];
    labelOnly: boolean;
    expanded?: boolean | null;
    onToggle?: (() => void) | null;
  }

  const { path, tool = null, diffLines, labelOnly, expanded = null, onToggle = null }: Props = $props();

  const added = $derived(diffLines.filter((line) => line.kind === "add").length);
  const removed = $derived(diffLines.filter((line) => line.kind === "del").length);
</script>

<Collapsible
  label={tool ?? path}
  preview={tool ? path : null}
  icon={FilePen}
  labelOnly={labelOnly || !diffLines.length}
  {expanded}
  {onToggle}
>
  {#snippet meta()}
    {#if added}<span class="text-green">+{added}</span>{/if}
    {#if removed}<span class="text-red">-{removed}</span>{/if}
  {/snippet}
  <DiffView {diffLines} />
</Collapsible>
