<script lang="ts">
  import type { ModDecoration } from "$lib/data/modModels";
  import { textStyle } from "./modStyle";

  interface Props {
    text: string;
    decorations: ModDecoration[];
    scrollTop: number;
    class?: string;
  }

  const { text, decorations, scrollTop, class: className = "" }: Props = $props();

  const PAINTED = ["color", "backgroundColor", "dimColor", "underline", "strikethrough", "inverse"];
  const FAUX_BOLD = "-webkit-text-stroke: 0.04em currentColor";

  let mirror = $state<HTMLElement | null>(null);

  const paint = (style: Record<string, unknown>): string => {
    const kept = textStyle(Object.fromEntries(PAINTED.filter((key) => key in style).map((key) => [key, style[key]])));
    return style.bold ? [kept, FAUX_BOLD].filter(Boolean).join("; ") : kept;
  };

  const runs = $derived.by(() => {
    const out: { text: string; style: string }[] = [];
    let at = 0;
    for (const decoration of decorations) {
      if (decoration.start < at) continue;
      if (decoration.start > at) out.push({ text: text.slice(at, decoration.start), style: "" });
      out.push({ text: text.slice(decoration.start, decoration.end), style: paint(decoration.style) });
      at = decoration.end;
    }
    if (at < text.length) out.push({ text: text.slice(at), style: "" });
    return out;
  });

  $effect(() => {
    if (mirror) mirror.scrollTop = scrollTop;
  });
</script>

<div
  bind:this={mirror}
  aria-hidden="true"
  class="pointer-events-none absolute inset-0 overflow-hidden break-words whitespace-pre-wrap text-on-surface {className}"
>
  {#each runs as run, index (index)}<span style={run.style}>{run.text}</span>{/each}&#8203;
</div>
