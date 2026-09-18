<script lang="ts">
  import Bold from "@lucide/svelte/icons/bold";
  import Code from "@lucide/svelte/icons/code";
  import Heading from "@lucide/svelte/icons/heading";
  import List from "@lucide/svelte/icons/list";
  import Redo2 from "@lucide/svelte/icons/redo-2";
  import SquareCheck from "@lucide/svelte/icons/square-check";
  import Undo2 from "@lucide/svelte/icons/undo-2";
  import { t } from "$lib/i18n/index.svelte";
  import MarkdownText from "$lib/ui/MarkdownText.svelte";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";
  import { notes, type Note } from "./notes.svelte";

  interface Props {
    note: Note;
  }

  const { note }: Props = $props();

  const ITEM_RE = /^(\s*)((?:[-*+]\s+\[[ xX]\]\s+)|(?:[-*+]\s+)|(?:\d+[.)]\s+))/;
  const TASK_RE = /^(\s*(?:[-*+]\s+|\d+[.)]\s+)\[)([ xX])(\])/;

  let field = $state<HTMLTextAreaElement | null>(null);

  const entry = $derived(notes.history[note.id]);

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

{#if notes.formatted}
  <div use:tasks class="tasks-live selectable min-h-0 flex-1 overflow-y-auto p-4">
    <MarkdownText text={note.body} />
  </div>
{:else}
  <textarea
    bind:this={field}
    value={note.body}
    oninput={(event) => notes.write(note.id, event.currentTarget.value)}
    onkeydown={onKeydown}
    spellcheck="false"
    class="min-h-0 flex-1 resize-none bg-transparent p-4 font-mono text-body-sm leading-[18px] caret-accent outline-none"
  ></textarea>
  <div class="flex shrink-0 items-center gap-1 border-t border-outline-variant bg-surface px-3 py-2">
    <TooltipIconButton
      label={t("UNDO")}
      tooltip={false}
      class="size-8 [&_svg]:size-5"
      enabled={!!entry?.past.length}
      onclick={undo}
    >
      <Undo2 />
    </TooltipIconButton>
    <TooltipIconButton
      label={t("REDO")}
      tooltip={false}
      class="size-8 [&_svg]:size-5"
      enabled={!!entry?.future.length}
      onclick={redo}
    >
      <Redo2 />
    </TooltipIconButton>
    <div class="mx-1 h-5 w-px shrink-0 bg-outline-variant"></div>
    <TooltipIconButton label={t("NOTE_TASK")} tooltip={false} class="size-8 [&_svg]:size-5" onclick={() => prefix("- [ ] ")}>
      <SquareCheck />
    </TooltipIconButton>
    <TooltipIconButton label={t("NOTE_BULLET")} tooltip={false} class="size-8 [&_svg]:size-5" onclick={() => prefix("- ")}>
      <List />
    </TooltipIconButton>
    <TooltipIconButton label={t("NOTE_HEADING")} tooltip={false} class="size-8 [&_svg]:size-5" onclick={() => prefix("## ")}>
      <Heading />
    </TooltipIconButton>
    <TooltipIconButton label={t("NOTE_BOLD")} tooltip={false} class="size-8 [&_svg]:size-5" onclick={() => wrap("**")}>
      <Bold />
    </TooltipIconButton>
    <TooltipIconButton label={t("NOTE_CODE")} tooltip={false} class="size-8 [&_svg]:size-5" onclick={() => wrap("`")}>
      <Code />
    </TooltipIconButton>
  </div>
{/if}
