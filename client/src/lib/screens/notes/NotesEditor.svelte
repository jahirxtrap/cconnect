<script lang="ts">
  import Bold from "@lucide/svelte/icons/bold";
  import Code from "@lucide/svelte/icons/code";
  import Heading from "@lucide/svelte/icons/heading";
  import Link from "@lucide/svelte/icons/link";
  import List from "@lucide/svelte/icons/list";
  import ListChecks from "@lucide/svelte/icons/list-checks";
  import Redo2 from "@lucide/svelte/icons/redo-2";
  import Undo2 from "@lucide/svelte/icons/undo-2";
  import type { Snippet } from "svelte";
  import { formatRecent } from "$lib/data/time";
  import { t } from "$lib/i18n/index.svelte";
  import { layout } from "$lib/platform/layout.svelte";
  import MarkdownText from "$lib/ui/MarkdownText.svelte";
  import { SCROLL_ROW_CLASS, TEXT_VIEWPORT_CLASS, viewportScrollbar } from "$lib/ui/scrollbar";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";
  import { notes, type Note } from "./notes.svelte";

  interface Props {
    note: Note;
    inset?: boolean;
    actions?: Snippet;
  }

  const { note, inset = true, actions }: Props = $props();

  const ITEM_RE = /^(\s*)((?:[-*+]\s+\[[ xX]\]\s+)|(?:[-*+]\s+)|(?:\d+[.)]\s+))/;
  const TASK_RE = /^(\s*(?:[-*+]\s+|\d+[.)]\s+)\[)([ xX])(\])/;
  const TOOL_CLASS = "size-7";
  const BODY_CLASS = `${TEXT_VIEWPORT_CLASS} min-h-0 flex-1 px-3.5 pt-2 pb-3.5`;

  let field = $state<HTMLTextAreaElement | null>(null);

  const entry = $derived(notes.history[note.id]);
  const editing = $derived(!notes.formatted);

  const apply = (value: string, caret: number) => {
    notes.apply(note.id, value);
    requestAnimationFrame(() => {
      field?.focus();
      field?.setSelectionRange(caret, caret);
    });
  };

  const undo = () => notes.undo(note.id);
  const redo = () => notes.redo(note.id);

  const wrap = (mark: string) => {
    if (!field) return;
    const { selectionStart: from, selectionEnd: to, value } = field;
    const next = `${value.slice(0, from)}${mark}${value.slice(from, to)}${mark}${value.slice(to)}`;
    apply(next, to + mark.length * 2);
  };

  const prefix = (mark: string) => {
    if (!field) return;
    const { selectionStart: from, value } = field;
    const start = value.lastIndexOf("\n", from - 1) + 1;
    const next = `${value.slice(0, start)}${mark}${value.slice(start)}`;
    apply(next, from + mark.length);
  };

  const link = () => {
    if (!field) return;
    const { selectionStart: from, selectionEnd: to, value } = field;
    const label = value.slice(from, to);
    const next = `${value.slice(0, from)}[${label}]()${value.slice(to)}`;
    apply(next, label ? from + label.length + 3 : from + 1);
  };

  const tools = [
    { label: "NOTE_HEADING", icon: Heading, run: () => prefix("## ") },
    { label: "NOTE_BOLD", icon: Bold, run: () => wrap("**") },
    { label: "NOTE_BULLET", icon: List, run: () => prefix("- ") },
    { label: "NOTE_TASK", icon: ListChecks, run: () => prefix("- [ ] ") },
    { label: "NOTE_CODE", icon: Code, run: () => wrap("`") },
    { label: "NOTE_LINK", icon: Link, run: link },
  ];

  const continued = (marker: string) => {
    const ordered = marker.match(/^(\d+)([.)]\s+)$/);
    if (ordered) return `${Number(ordered[1]) + 1}${ordered[2]}`;
    return marker.replace(/\[[xX]\]/, "[ ]");
  };

  const onKeydown = (event: KeyboardEvent) => {
    if ((event.metaKey || event.ctrlKey) && event.code === "KeyZ") {
      event.preventDefault();
      if (event.shiftKey) redo();
      else undo();
      return;
    }
    if ((event.metaKey || event.ctrlKey) && event.code === "KeyY") {
      event.preventDefault();
      redo();
      return;
    }
    if (event.key !== "Enter" || event.shiftKey || !field) return;
    const { selectionStart: from, selectionEnd: to, value } = field;
    if (from !== to) return;
    const start = value.lastIndexOf("\n", from - 1) + 1;
    const line = value.slice(start, from);
    const match = line.match(ITEM_RE);
    if (!match) return;
    event.preventDefault();
    if (!line.slice(match[0].length).trim()) {
      apply(`${value.slice(0, start)}${value.slice(from)}`, start);
      return;
    }
    const lead = `\n${match[1]}${continued(match[2])}`;
    apply(`${value.slice(0, from)}${lead}${value.slice(from)}`, from + lead.length);
  };

  const toggled = (index: number) => {
    let seen = -1;
    return note.body
      .split("\n")
      .map((line) => {
        const match = line.match(TASK_RE);
        if (!match) return line;
        seen++;
        if (seen !== index) return line;
        const mark = match[2] === " " ? "x" : " ";
        return `${match[1]}${mark}${match[3]}${line.slice(match[0].length)}`;
      })
      .join("\n");
  };

  const tasks = (node: HTMLElement) => {
    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const item = target.closest("li.task");
      if (!item) return;
      const index = [...node.querySelectorAll("li.task")].indexOf(item);
      if (index >= 0) notes.apply(note.id, toggled(index));
    };
    node.addEventListener("click", onClick);
    return { destroy: () => node.removeEventListener("click", onClick) };
  };
</script>

<div class="flex min-h-0 flex-1 flex-col {inset ? 'px-(--page-inset) pb-(--page-inset)' : ''}">
  <div class="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl bg-card">
    <div class="{SCROLL_ROW_CLASS} mx-2 mt-2 flex shrink-0 items-center">
      {#each tools as tool (tool.label)}
        <TooltipIconButton
          label={t(tool.label)}
          tooltip={false}
          enabled={editing}
          class={TOOL_CLASS}
          onclick={tool.run}
        >
          <tool.icon />
        </TooltipIconButton>
      {/each}
      <TooltipIconButton
        label={t("UNDO")}
        tooltip={false}
        enabled={!!entry?.past.length}
        class="ml-2 {TOOL_CLASS}"
        onclick={undo}
      >
        <Undo2 />
      </TooltipIconButton>
      <TooltipIconButton
        label={t("REDO")}
        tooltip={false}
        enabled={!!entry?.future.length}
        class={TOOL_CLASS}
        onclick={redo}
      >
        <Redo2 />
      </TooltipIconButton>
      <span class="min-w-0 flex-1"></span>
      {#if !layout.mobile}
        <span class="min-w-0 truncate px-2 text-body-sm text-faint">{formatRecent(note.updatedAt)}</span>
      {/if}
      {@render actions?.()}
    </div>
    {#if notes.formatted}
      <div use:tasks use:viewportScrollbar class="tasks-live selectable overflow-y-auto {BODY_CLASS}">
        <MarkdownText text={note.body} class="markdown-chat" />
      </div>
    {:else}
      <textarea
        bind:this={field}
        use:viewportScrollbar
        value={note.body}
        oninput={(event) => notes.write(note.id, event.currentTarget.value)}
        onkeydown={onKeydown}
        spellcheck="false"
        class="resize-none bg-transparent text-body-md leading-(--chat-line-body) caret-accent outline-none {BODY_CLASS}"
      ></textarea>
    {/if}
  </div>
</div>

<style>
  .tasks-live :global(.markdown h1),
  .tasks-live :global(.markdown h2) {
    font-size: var(--text-headline);
    line-height: var(--text-headline--line-height);
  }
</style>
