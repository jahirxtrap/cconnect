<script lang="ts">
  import { theme } from "$lib/design/theme.svelte";
  import { highlight, resolveLang } from "$lib/markdown/highlighter";

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

  const LINE_BREAK = /<br\s*\/?>/;

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
  let highlighted = $state<string | null>(null);
  let sought: number | null = null;

  const source = $derived(text.replace(/\r\n?/g, "\n"));

  const lines = $derived(
    (highlighted === null ? source.split("\n") : highlighted.split(LINE_BREAK)).map(filled),
  );

  const trailing = $derived(
    Object.entries(removed)
      .filter(([number]) => Number(number) > lines.length)
      .flatMap(([, gone]) => gone),
  );

  const gutter = $derived(`calc(${String(lines.length).length}ch + 1rem)`);

  $effect(() => {
    const body = source;
    const target = language;
    const dark = theme.dark;
    if (!target) {
      highlighted = null;
      return;
    }
    let active = true;
    void highlight(body, target, dark).then((result) => {
      if (active) highlighted = result;
    });
    return () => {
      active = false;
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
  style="--gutter-raw: {gutter}"
  class="code-gutter overflow-y-auto font-mono text-body-sm leading-[18px] {className}"
>
  <div
    class="relative min-h-full py-3 {numbers
      ? 'after:absolute after:inset-y-0 after:left-[var(--gutter)] after:w-px after:bg-outline-variant'
      : ''}"
  >
    {#each lines as line, index (index)}
      {@const number = index + 1}
      {@const here = marking.has(number)}
      {#each removed[number] ?? [] as gone, at (at)}
        <div
          class="{LINE_CLASS} bg-red-bg text-red {number === anchor
            ? 'border-accent'
            : 'border-transparent'}"
        >{filled(gone)}</div>
      {/each}
      <div
        data-line={number}
        class="{LINE_CLASS} {here ? 'border-accent' : 'border-transparent'} {marked.has(number)
          ? 'bg-green-bg'
          : ''}"
      >{#if highlighted === null}{line}{:else}{@html line}{/if}</div>
    {/each}
    {#each trailing as gone, at (at)}
      <div class="{LINE_CLASS} border-transparent bg-red-bg text-red">{filled(gone)}</div>
    {/each}
  </div>
</div>
