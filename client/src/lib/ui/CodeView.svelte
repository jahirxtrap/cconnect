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
    class?: string;
  }

  const {
    text,
    lang = null,
    added = [],
    removed = {},
    current = [],
    anchor = null,
    class: className = "",
  }: Props = $props();

  const LINE_BREAK = /<br\s*\/?>/;

  const filled = (line: string) => line || " ";

  const language = $derived(resolveLang(lang));
  const marked = $derived(new Set(added));
  const marking = $derived(new Set(current));

  let scroller = $state<HTMLDivElement | null>(null);
  let highlighted = $state<string | null>(null);

  const lines = $derived(
    (highlighted === null ? text.split("\n") : highlighted.split(LINE_BREAK)).map(filled),
  );

  const trailing = $derived(
    Object.entries(removed)
      .filter(([number]) => Number(number) > lines.length)
      .flatMap(([, gone]) => gone),
  );

  $effect(() => {
    const body = text;
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
    if (line === null || !scroller) return;
    scroller
      .querySelector(`[data-line="${line}"]`)
      ?.scrollIntoView({ block: "center", behavior: "instant" });
  });
</script>

<div
  bind:this={scroller}
  class="overflow-y-auto py-3 font-mono text-body-sm leading-[18px] {className}"
>
  {#each lines as line, index (index)}
    {@const number = index + 1}
    {@const here = marking.has(number)}
    {#each removed[number] ?? [] as gone, at (at)}
      <div
        class="border-l-2 bg-red-bg px-2.5 py-px break-all whitespace-pre-wrap text-red {number ===
        anchor
          ? 'border-accent'
          : 'border-transparent'}"
      >{filled(gone)}</div>
    {/each}
    <div
      data-line={number}
      class="border-l-2 px-2.5 py-px break-all whitespace-pre-wrap {here
        ? 'border-accent'
        : 'border-transparent'} {marked.has(number) ? 'bg-green-bg' : ''}"
    >{#if highlighted === null}{line}{:else}{@html line}{/if}</div>
  {/each}
  {#each trailing as gone, at (at)}
    <div
      class="border-l-2 border-transparent bg-red-bg px-2.5 py-px break-all whitespace-pre-wrap text-red"
    >{filled(gone)}</div>
  {/each}
</div>
