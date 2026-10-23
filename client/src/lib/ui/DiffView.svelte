<script lang="ts">
  import type { DiffLine } from "$lib/data/chatModels";
  import { hscrollbar } from "./scrollbar";

  interface Props {
    diffLines: DiffLine[];
    class?: string;
  }

  const { diffLines, class: className = "" }: Props = $props();

  const LINE_CLASS: Record<DiffLine["kind"], string> = {
    header: "text-faint",
    hunk: "text-blue bg-blue-bg",
    add: "text-on-surface bg-green-bg",
    del: "text-on-surface-variant bg-red-bg",
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

<div
  use:hscrollbar={{ touchIndicator: true }}
  class="no-scrollbar w-full overflow-x-auto rounded-md font-mono text-body-sm leading-[18px] {className}"
>
  <div class="flex w-max min-w-full flex-col">
    {#each diffLines as line, index (index)}
      <div class="px-2 py-px whitespace-pre {LINE_CLASS[line.kind]}">{!line.text &&
        !PREFIX[line.kind]
          ? " "
          : `${PREFIX[line.kind]}${line.text}`}</div>
    {/each}
  </div>
</div>
