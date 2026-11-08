<script lang="ts">
  import KeyRound from "@lucide/svelte/icons/key-round";
  import type { ColumnShape } from "$lib/data/databaseModels";
  import { joined } from "$lib/data/format";
  import { t } from "$lib/i18n/index.svelte";

  interface Props {
    columns: ColumnShape[];
  }

  const { columns }: Props = $props();

  const CELL_CLASS = "border-b border-outline-variant px-2 py-1 align-top";
</script>

<table class="min-w-full border-separate border-spacing-0 text-body-sm">
  <tbody>
    {#each columns as column (column.name)}
      <tr>
        <td class="{CELL_CLASS} whitespace-nowrap font-mono">
          <span class="flex items-center gap-1">
            {#if column.primaryKey}
              <KeyRound size={12} class="shrink-0 text-accent" />
            {/if}
            {column.name}
          </span>
        </td>
        <td class="{CELL_CLASS} whitespace-nowrap font-mono text-on-surface-variant">{column.type}</td>
        <td class="{CELL_CLASS} whitespace-nowrap text-on-surface-variant">
          {joined(
            column.nullable ? "NULL" : "NOT NULL",
            column.auto && t("DATABASE_AUTO"),
            column.default !== null && t("DATABASE_DEFAULT_VALUE", column.default),
          )}
        </td>
        <td class="{CELL_CLASS} text-on-surface-variant">{column.comment ?? ""}</td>
      </tr>
    {/each}
  </tbody>
</table>
