<script lang="ts">
  import FilePen from "@lucide/svelte/icons/file-pen";
  import type { DiffLine, NotebookCell } from "$lib/data/chatModels";
  import { t } from "$lib/i18n/index.svelte";
  import DiffView from "$lib/ui/DiffView.svelte";
  import Collapsible from "./Collapsible.svelte";

  interface Props {
    path: string;
    tool?: string | null;
    diffLines: DiffLine[];
    cell?: NotebookCell | null;
    labelOnly: boolean;
    expanded?: boolean | null;
    onToggle?: (() => void) | null;
  }

  const { path, tool = null, diffLines, cell = null, labelOnly, expanded = null, onToggle = null }: Props = $props();

  const CELL_TEXTS: Record<string, string> = {
    replace: "NOTEBOOK_CELL_REPLACED",
    insert: "NOTEBOOK_CELL_INSERTED",
    delete: "NOTEBOOK_CELL_DELETED",
  };

  const added = $derived(diffLines.filter((line) => line.kind === "add").length);
  const removed = $derived(diffLines.filter((line) => line.kind === "del").length);
  const cellText = $derived.by(() => {
    if (!cell) return null;
    if (cell.editMode === "insert" && !cell.cellId) return t("NOTEBOOK_CELL_INSERTED_FIRST");
    const key = CELL_TEXTS[cell.editMode];
    return key && cell.cellId ? t(key, cell.cellId) : null;
  });
</script>

<Collapsible
  label={tool ?? path}
  preview={tool ? path : null}
  previewTail
  icon={FilePen}
  labelOnly={labelOnly || (!diffLines.length && !cellText)}
  {expanded}
  {onToggle}
>
  {#snippet meta()}
    {#if added}<span class="text-green">+{added}</span>{/if}
    {#if removed}<span class="text-red">-{removed}</span>{/if}
  {/snippet}
  <div class="chat-gap flex flex-col">
    {#if cellText}
      <p class="text-body-sm text-on-surface-variant">{cellText}</p>
    {/if}
    {#if diffLines.length}
      <DiffView {diffLines} />
    {/if}
  </div>
</Collapsible>
