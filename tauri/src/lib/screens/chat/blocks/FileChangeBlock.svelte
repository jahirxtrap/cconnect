<script lang="ts">
  import FilePen from "@lucide/svelte/icons/file-pen";
  import type { DiffLine } from "$lib/data/chatModels";
  import Collapsible from "./Collapsible.svelte";

  interface Props {
    path: string;
    diffLines: DiffLine[];
    labelOnly: boolean;
  }

  const { path, diffLines, labelOnly }: Props = $props();

  const LINE_CLASS: Record<DiffLine["kind"], string> = {
    header: "text-on-surface-variant",
    hunk: "text-blue bg-blue-bg",
    add: "text-green bg-green-bg",
    del: "text-red bg-red-bg",
    ctx: "text-on-surface-variant",
  };
</script>

<Collapsible label={path} icon={FilePen} labelOnly={labelOnly || !diffLines.length} labelClass="text-accent">
  <div class="w-full overflow-x-auto rounded-panel bg-surface-variant py-1 font-mono text-body-sm leading-snug">
    {#each diffLines as line, index (index)}
      <div class="px-2.5 whitespace-pre {LINE_CLASS[line.kind]}">{line.text || " "}</div>
    {/each}
  </div>
</Collapsible>
