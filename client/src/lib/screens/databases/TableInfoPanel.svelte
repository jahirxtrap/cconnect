<script lang="ts">
  import KeyRound from "@lucide/svelte/icons/key-round";
  import { qualifiedName, type TableInfo } from "$lib/data/databaseModels";
  import { joined } from "$lib/data/format";
  import { t } from "$lib/i18n/index.svelte";
  import CodeBlock from "$lib/ui/CodeBlock.svelte";
  import { viewportScrollbar } from "$lib/ui/scrollbar";
  import SectionHeader from "$lib/ui/SectionHeader.svelte";

  interface Props {
    info: TableInfo;
  }

  const { info }: Props = $props();

  const CELL_CLASS = "border-b border-outline-variant px-2 py-1 align-top";
</script>

<div class="flex max-h-[40%] shrink-0 flex-col overflow-hidden rounded-panel bg-card">
  <div use:viewportScrollbar class="rounded-viewport scrollbar-thin selectable min-h-0 overflow-auto px-2 pb-2 [--viewport-inset:0px]">
    {#if info.comment}
      <p class="px-1 pb-1 text-body-sm text-on-surface-variant">{info.comment}</p>
    {/if}
    <SectionHeader label={t("DATABASE_COLUMNS")} />
    <table class="min-w-full border-separate border-spacing-0 text-body-sm">
      <tbody>
        {#each info.columns as column (column.name)}
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
    {#if info.foreignKeys.length}
      <SectionHeader label={t("DATABASE_FOREIGN_KEYS")} divider />
      {#each info.foreignKeys as key, index (index)}
        <p class="px-1 py-0.5 font-mono text-body-sm">
          {key.columns.join(", ")} → {qualifiedName(key.schema, key.table)} ({key.referred.join(", ")})
        </p>
      {/each}
    {/if}
    {#if info.indexes.length}
      <SectionHeader label={t("DATABASE_INDEXES")} divider />
      {#each info.indexes as index, at (at)}
        <p class="px-1 py-0.5 text-body-sm">
          <span class="font-mono">{index.name ?? ""}</span>
          <span class="text-on-surface-variant">{joined(index.columns.join(", "), index.unique && "UNIQUE")}</span>
        </p>
      {/each}
    {/if}
    {#if info.definition}
      <SectionHeader label={t("DATABASE_DEFINITION")} divider />
      <CodeBlock code={info.definition} lang="sql" />
    {/if}
  </div>
</div>
