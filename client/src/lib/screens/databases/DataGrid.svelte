<script lang="ts">
  import ChevronDown from "@lucide/svelte/icons/chevron-down";
  import ChevronUp from "@lucide/svelte/icons/chevron-up";
  import KeyRound from "@lucide/svelte/icons/key-round";
  import { cellText, type CellValue, type ColumnKind } from "$lib/data/databaseModels";
  import { formatDecimal } from "$lib/data/format";
  import { viewportScrollbar } from "$lib/ui/scrollbar";

  interface Props {
    columns: string[];
    rows: CellValue[][];
    offset?: number;
    kinds?: Record<string, ColumnKind>;
    keys?: string[];
    sort?: string | null;
    descending?: boolean;
    onSort?: ((column: string) => void) | null;
    onRow?: ((index: number) => void) | null;
  }

  const {
    columns,
    rows,
    offset = 0,
    kinds = {},
    keys = [],
    sort = null,
    descending = false,
    onSort = null,
    onRow = null,
  }: Props = $props();

  const NUMERIC: ColumnKind[] = ["integer", "number"];
  const CELL_CLASS = "max-w-80 truncate border-b border-outline-variant px-2 py-1.5";
  const HEAD_CLASS = "sticky top-0 border-b border-outline-variant bg-card px-2 py-1.5 text-left font-semibold select-none";
  const NUMBER_CLASS = "sticky left-0 w-px border-b border-outline-variant bg-card px-2 py-1.5 text-right text-faint select-none";

  const alignOf = (column: string) => (NUMERIC.includes(kinds[column]) ? "text-right" : "");
</script>

<div
  use:viewportScrollbar
  class="rounded-viewport scrollbar-thin min-h-0 flex-1 overflow-auto [--viewport-inset:0px] {onRow ? 'select-none' : 'selectable'}"
>
  <table class="min-w-full border-separate border-spacing-0 text-body-sm">
    <thead>
      <tr>
        <th class="{HEAD_CLASS} left-0 z-20 w-px"></th>
        {#each columns as column, at (at)}
          <th class="{HEAD_CLASS} z-10">
            {#if onSort}
              <button
                type="button"
                onclick={() => onSort(column)}
                class="flex w-full cursor-pointer items-center gap-1 whitespace-nowrap {alignOf(column) ? 'justify-end' : ''}"
              >
                {@render label(column)}
              </button>
            {:else}
              <span class="flex items-center gap-1 whitespace-nowrap {alignOf(column) ? 'justify-end' : ''}">{@render label(column)}</span>
            {/if}
          </th>
        {/each}
      </tr>
    </thead>
    <tbody class="font-mono">
      {#each rows as row, index (index)}
        <tr
          onclick={onRow ? () => onRow(index) : undefined}
          class="transition-colors hover:bg-hover {onRow ? 'cursor-pointer' : ''}"
        >
          <td class={NUMBER_CLASS}>{formatDecimal(offset + index + 1, 0)}</td>
          {#each columns as column, at (at)}
            {@const value = row[at] ?? null}
            <td class="{CELL_CLASS} {alignOf(column)}">
              {#if value === null}
                <span class="text-faint italic">NULL</span>
              {:else}
                {cellText(value)}
              {/if}
            </td>
          {/each}
        </tr>
      {/each}
    </tbody>
  </table>
</div>

{#snippet label(column: string)}
  {#if keys.includes(column)}
    <KeyRound size={12} class="shrink-0 text-accent" />
  {/if}
  <span>{column}</span>
  {#if sort === column}
    {#if descending}
      <ChevronDown size={14} class="shrink-0" />
    {:else}
      <ChevronUp size={14} class="shrink-0" />
    {/if}
  {/if}
{/snippet}
