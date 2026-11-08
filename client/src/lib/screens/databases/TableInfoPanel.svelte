<script lang="ts">
  import { qualifiedName, type TableInfo } from "$lib/data/databaseModels";
  import { joined } from "$lib/data/format";
  import { t } from "$lib/i18n/index.svelte";
  import CodeBlock from "$lib/ui/CodeBlock.svelte";
  import { viewportScrollbar } from "$lib/ui/scrollbar";
  import SectionHeader from "$lib/ui/SectionHeader.svelte";
  import ColumnsTable from "./ColumnsTable.svelte";

  interface Props {
    info: TableInfo;
  }

  const { info }: Props = $props();
</script>

<div class="flex max-h-[40%] shrink-0 flex-col overflow-hidden rounded-panel bg-card">
  <div use:viewportScrollbar class="rounded-viewport scrollbar-thin selectable min-h-0 overflow-auto px-2 pb-2 [--viewport-inset:0px]">
    {#if info.comment}
      <p class="px-1 pb-1 text-body-sm text-on-surface-variant">{info.comment}</p>
    {/if}
    <SectionHeader label={t("DATABASE_COLUMNS")} />
    <ColumnsTable columns={info.columns} />
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
