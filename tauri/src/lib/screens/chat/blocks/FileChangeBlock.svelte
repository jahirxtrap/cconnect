<script lang="ts">
  import FilePen from "@lucide/svelte/icons/file-pen";
  import type { DiffLine } from "$lib/data/chatModels";
  import { hscrollbar } from "$lib/ui/scrollbar";
  import Collapsible from "./Collapsible.svelte";

  interface Props {
    path: string;
    diffLines: DiffLine[];
    labelOnly: boolean;
    expanded?: boolean | null;
    onToggle?: (() => void) | null;
  }

  const { path, diffLines, labelOnly, expanded = null, onToggle = null }: Props = $props();

  const LINE_CLASS: Record<DiffLine["kind"], string> = {
    header: "text-gray",
    hunk: "text-blue bg-blue-bg",
    add: "text-green bg-green-bg",
    del: "text-red bg-red-bg",
    ctx: "text-on-surface-variant",
  };

  const PREFIX: Record<DiffLine["kind"], string> = {
    header: "",
    hunk: "",
    add: "+",
    del: "-",
    ctx: " ",
  };
</script>

<Collapsible
  label={path}
  icon={FilePen}
  labelOnly={labelOnly || !diffLines.length}
  {expanded}
  {onToggle}
  labelClass="text-accent"
>
  <div
    use:hscrollbar
    class="no-scrollbar w-full overflow-x-auto rounded-sm bg-surface-variant py-1 font-mono text-body-sm leading-[18px]"
  >
    {#each diffLines as line, index (index)}
      <div class="w-max px-2.5 py-px whitespace-pre {LINE_CLASS[line.kind]}">{!line.text &&
        !PREFIX[line.kind]
          ? " "
          : `${PREFIX[line.kind]}${line.text}`}</div>
    {/each}
  </div>
</Collapsible>
