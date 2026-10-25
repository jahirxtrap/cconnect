<script lang="ts">
  import type { DiffLine } from "$lib/data/chatModels";
  import { DIFF_LINE, DIFF_SIGN, DIFF_SIGN_COLUMN } from "./diffTones";
  import { hscrollbar } from "./scrollbar";

  interface Props {
    diffLines: DiffLine[];
    class?: string;
  }

  const { diffLines, class: className = "" }: Props = $props();

  const LINE_CLASS: Record<DiffLine["kind"], string> = {
    header: "text-faint",
    hunk: "text-blue bg-blue-bg",
    ...DIFF_LINE,
  };

  const PREFIX: Record<DiffLine["kind"], string> = {
    header: "",
    hunk: "",
    add: "+",
    del: "-",
    ctx: " ",
  };

  const signClass = (kind: DiffLine["kind"]) => (kind === "add" || kind === "del" ? DIFF_SIGN[kind] : "");
</script>

<div
  use:hscrollbar={{ touchIndicator: true }}
  class="no-scrollbar w-full overflow-x-auto rounded-md font-mono text-body-sm leading-[18px] {className}"
>
  <div class="flex w-max min-w-full flex-col">
    {#each diffLines as line, index (index)}
      <div class="px-2 py-px whitespace-pre {LINE_CLASS[line.kind]}">{#if PREFIX[line.kind]}<span
            class="{DIFF_SIGN_COLUMN} {signClass(line.kind)}">{PREFIX[line.kind]}</span>{line.text}{:else}{line.text || " "}{/if}</div>
    {/each}
  </div>
</div>
