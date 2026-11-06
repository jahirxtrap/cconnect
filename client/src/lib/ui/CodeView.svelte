<script lang="ts">
  import { untrack } from "svelte";
  import { theme } from "$lib/design/theme.svelte";
  import { VISIBLE_LINES, highlightSlices, resolveLang } from "$lib/markdown/highlighter";
  import { DIFF_LINE } from "./diffTones";
  import { viewportScrollbar } from "./scrollbar";

  interface Props {
    text: string;
    lang?: string | null;
    added?: number[];
    removed?: Record<number, string[]>;
    current?: number[];
    anchor?: number | null;
    numbers?: boolean;
    class?: string;
  }

  const {
    text,
    lang = null,
    added = [],
    removed = {},
    current = [],
    anchor = null,
    numbers = true,
    class: className = "",
  }: Props = $props();

  const NUMBERED =
    "pl-[calc(var(--gutter)+0.625rem)] before:absolute before:left-0 before:w-[var(--gutter)] " +
    "before:pr-2 before:text-right before:text-on-surface-variant before:content-[attr(data-line)]";

  const LINE_CLASS = $derived(
    `relative border-l-2 py-px pr-2.5 break-all whitespace-pre-wrap ${numbers ? NUMBERED : "pl-2.5"}`,
  );

  const filled = (line: string) => line.replace(/\r$/, "") || " ";

  const language = $derived(resolveLang(lang));
  const marked = $derived(new Set(added));
  const marking = $derived(new Set(current));

  let scroller = $state<HTMLDivElement | null>(null);
  let colored = $state<string[]>([]);
  let coloredSource: string | null = null;
  let coloredTheme: string | null = null;
  let sought: number | null = null;

  const source = $derived(text.replace(/\r\n?/g, "\n"));

  const lines = $derived(source.split("\n").map(filled));

  const trailing = $derived(
    Object.entries(removed)
      .filter(([number]) => Number(number) > lines.length)
      .flatMap(([, gone]) => gone),
  );

  const gutter = $derived(`calc(${String(lines.length).length}ch + 1rem)`);

  const uncolor = () => {
    colored = [];
    coloredSource = null;
  };

  $effect(() => {
    const body = source;
    const target = language;
    const syntax = theme.syntax;
    if (coloredSource !== body || !target) uncolor();
    if (!target) return;
    const slices = highlightSlices(body, target, syntax, (untrack(() => anchor) ?? 0) + VISIBLE_LINES);
    let active = true;
    void (async () => {
      let at = 0;
      try {
        for await (const slice of slices) {
          if (!active) return;
          const html = slice.map(filled);
          if (coloredSource === body && coloredTheme === syntax) html.forEach((line, offset) => (colored[at + offset] = line));
          else {
            colored = html;
            coloredSource = body;
            coloredTheme = syntax;
          }
          at += html.length;
        }
      } catch {
        if (active) uncolor();
      }
    })();
    return () => {
      active = false;
      void slices.return(undefined);
    };
  });

  $effect(() => {
    const line = anchor;
    void lines.length;
    if (line === null) {
      sought = null;
      return;
    }
    if (line === sought || !scroller) return;
    const target = scroller.querySelector(`[data-line="${line}"]`);
    if (!target) return;
    sought = line;
    target.scrollIntoView({ block: "center", behavior: "instant" });
  });
</script>

<div
  bind:this={scroller}
  use:viewportScrollbar
  style="--gutter-raw: {gutter}"
  class="code-gutter overflow-y-auto font-mono text-body-sm leading-[18px] {className}"
>
  <div class="relative min-h-full py-3">
    {#each lines as line, index (index)}
      {@const number = index + 1}
      {@const here = marking.has(number)}
      {#each removed[number] ?? [] as gone, at (at)}
        <div
          class="{LINE_CLASS} {DIFF_LINE.del} {number === anchor
            ? 'border-accent'
            : 'border-transparent'}"
        >{filled(gone)}</div>
      {/each}
      <div
        data-line={number}
        class="{LINE_CLASS} {here ? 'border-accent' : 'border-transparent'} {marked.has(number)
          ? DIFF_LINE.add
          : ''}"
      >{#if colored[index] === undefined}{line}{:else}{@html colored[index]}{/if}</div>
    {/each}
    {#each trailing as gone, at (at)}
      <div class="{LINE_CLASS} border-transparent {DIFF_LINE.del}">{filled(gone)}</div>
    {/each}
  </div>
</div>
