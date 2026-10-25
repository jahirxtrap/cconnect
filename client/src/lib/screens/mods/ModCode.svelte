<script lang="ts">
  import { theme } from "$lib/design/theme.svelte";
  import { highlight, resolveLang } from "$lib/markdown/highlighter";
  import { DIFF_LINE, DIFF_SIGN, DIFF_SIGN_COLUMN } from "$lib/ui/diffTones";

  interface Props {
    source: string;
    language: string | null;
    diff: boolean;
    startLine: number | null;
    truncate: boolean;
  }

  const { source, language, diff, startLine, truncate }: Props = $props();

  interface Row {
    number: number | null;
    sign: string;
    html: string | null;
    text: string;
    tone: "add" | "del" | "ctx" | "gap";
  }

  const HUNK = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/;
  const LINE_BREAK = /<br\s*\/?>/;
  const TONES: Record<Row["tone"], string> = {
    ...DIFF_LINE,
    gap: "text-on-surface-variant",
  };

  const signClass = (tone: Row["tone"]) => (tone === "add" || tone === "del" ? DIFF_SIGN[tone] : "");

  let highlighted = $state<string[] | null>(null);

  const text = $derived(source.replace(/\r\n?/g, "\n").replace(/\n+$/, ""));
  const lang = $derived(diff ? null : resolveLang(language));
  const wrapClass = $derived(truncate ? "truncate" : "whitespace-pre-wrap wrap-anywhere");

  const diffRows = (body: string): Row[] => {
    const rows: Row[] = [];
    let oldLine = 0;
    let newLine = 0;
    let started = false;
    for (const line of body.split("\n")) {
      const hunk = HUNK.exec(line);
      if (hunk) {
        if (started) rows.push({ number: null, sign: "", html: null, text: "⋯", tone: "gap" });
        started = true;
        oldLine = Number(hunk[1]);
        newLine = Number(hunk[2]);
        continue;
      }
      if (!started || line.startsWith("\\")) continue;
      const sign = line[0] ?? " ";
      const rest = line.slice(1);
      if (sign === "+") rows.push({ number: newLine++, sign, html: null, text: rest, tone: "add" });
      else if (sign === "-") rows.push({ number: oldLine++, sign, html: null, text: rest, tone: "del" });
      else {
        rows.push({ number: newLine, sign: " ", html: null, text: rest, tone: "ctx" });
        oldLine++;
        newLine++;
      }
    }
    return rows;
  };

  const rows = $derived<Row[]>(
    diff
      ? diffRows(text)
      : text.split("\n").map((line, index) => ({
          number: startLine === null ? null : startLine + index,
          sign: "",
          html: highlighted?.[index] ?? null,
          text: line,
          tone: "ctx",
        })),
  );

  const gutter = $derived(Math.max(0, ...rows.map((row) => (row.number === null ? 0 : String(row.number).length))));
  const numbered = $derived(diff || startLine !== null);

  $effect(() => {
    const body = text;
    const target = lang;
    const syntax = theme.syntax;
    highlighted = null;
    if (!target) return;
    let active = true;
    void highlight(body, target, syntax).then((html) => {
      if (active) highlighted = html.split(LINE_BREAK);
    });
    return () => {
      active = false;
    };
  });
</script>

<div class="flex min-w-0 shrink-0 flex-col rounded-md bg-surface-variant py-2 font-mono text-body-sm leading-[18px]">
  {#each rows as row, index (index)}
    <div class="flex min-w-0 flex-row px-3 {TONES[row.tone]}">
      {#if numbered}
        <span class="shrink-0 pr-2 text-right text-on-surface-variant select-none" style="width: calc({gutter}ch + 0.5rem)"
          >{row.number ?? ""}</span
        >
        {#if diff}<span class="{DIFF_SIGN_COLUMN} {signClass(row.tone)}">{row.sign}</span>{/if}
      {/if}
      <span class="min-w-0 flex-1 {wrapClass}"
        >{#if row.html !== null}{@html row.html || " "}{:else}{row.text || " "}{/if}</span
      >
    </div>
  {/each}
</div>
