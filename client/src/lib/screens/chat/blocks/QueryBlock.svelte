<script lang="ts">
  import Table2 from "@lucide/svelte/icons/table-2";
  import View from "@lucide/svelte/icons/view";
  import { screenFor } from "$lib/app/screens";
  import { openDatabaseObject, type DatabaseObjectRef } from "$lib/app/viewer.svelte";
  import type { QueryCall, QueryStatement, StatementEffect } from "$lib/data/chatModels";
  import { qualifiedName, statementSummary } from "$lib/data/databaseModels";
  import { formatDecimal, joined } from "$lib/data/format";
  import { plural, t } from "$lib/i18n/index.svelte";
  import ColumnsTable from "$lib/screens/databases/ColumnsTable.svelte";
  import DataGrid from "$lib/screens/databases/DataGrid.svelte";
  import { backend } from "$lib/services/backend.svelte";
  import { databases } from "$lib/services/databases.svelte";
  import { contextServer } from "$lib/services/serverContext";
  import Button from "$lib/ui/Button.svelte";
  import Chip from "$lib/ui/Chip.svelte";
  import CodeBlock, { CAPPED_HEIGHT } from "$lib/ui/CodeBlock.svelte";
  import { TEXT_VIEWPORT_CLASS, viewportScrollbar } from "$lib/ui/scrollbar";
  import Collapsible from "./Collapsible.svelte";

  interface Props {
    query: QueryCall;
    statements: QueryStatement[] | null;
    result: string | null;
    running: boolean;
    expanded?: boolean | null;
    onToggle?: (() => void) | null;
  }

  const { query, statements, result, running, expanded = null, onToggle = null }: Props = $props();

  const SQL_LANG = "sql";
  const FRAME = `flex ${CAPPED_HEIGHT} flex-col overflow-hidden rounded-panel bg-surface-nested [--color-card:var(--color-surface-nested)]`;
  const DATABASES_ICON = screenFor("databases").icon;
  const OPENABLE = ["table", "view"];
  const DROPPED = "dropped";
  const ROW_KEYS: Record<string, string> = {
    inserted: "DATABASE_ROWS_INSERTED",
    updated: "DATABASE_ROWS_UPDATED",
    deleted: "DATABASE_ROWS_DELETED",
  };
  const EFFECT_KEYS: Record<string, string> = {
    "created.table": "DATABASE_CREATED_TABLE",
    "altered.table": "DATABASE_ALTERED_TABLE",
    "dropped.table": "DATABASE_DROPPED_TABLE",
    "created.view": "DATABASE_CREATED_VIEW",
    "altered.view": "DATABASE_ALTERED_VIEW",
    "dropped.view": "DATABASE_DROPPED_VIEW",
    "created.index": "DATABASE_CREATED_INDEX",
    "dropped.index": "DATABASE_DROPPED_INDEX",
    "created.database": "DATABASE_CREATED_DATABASE",
    "dropped.database": "DATABASE_DROPPED_DATABASE",
    "created.schema": "DATABASE_CREATED_SCHEMA",
    "dropped.schema": "DATABASE_DROPPED_SCHEMA",
  };

  const server = contextServer();

  const countOf = (statement: QueryStatement): string | null => {
    if (statement.kind === "rows") return statementSummary(statement.rows?.length ?? 0, null);
    if (statement.kind !== "changed" || statement.affected === null) return null;
    const key = statement.effect ? ROW_KEYS[statement.effect.action] : undefined;
    return key ? plural(key, statement.affected, formatDecimal(statement.affected, 0)) : statementSummary(null, statement.affected);
  };

  const summaryOf = (statement: QueryStatement): string => {
    const counted = countOf(statement);
    if (counted !== null) {
      const shown = statement.rows?.length ?? 0;
      const more = statement.kind === "rows" ? t("DATABASE_ROWS_MORE") : t("DATABASE_TRUNCATED", formatDecimal(shown, 0));
      return joined(counted, statement.more && more);
    }
    const key = statement.effect ? EFFECT_KEYS[`${statement.effect.action}.${statement.effect.object}`] : undefined;
    return key && statement.effect?.name ? t(key, statement.effect.name) : statementSummary(null, statement.affected);
  };

  const label = $derived(joined(query.name || query.connection, query.database));
  const last = $derived(statements?.at(-1) ?? null);
  const failure = $derived(!statements?.length && result?.trim() ? result : null);
  const openable = $derived(query.saved && server()?.id === backend.activeId);

  const sameObject = (one: StatementEffect, other: StatementEffect | null) =>
    !!other && other.object === one.object && other.schema === one.schema && other.name === one.name;

  const droppedAfter = (effect: StatementEffect, index: number) =>
    (statements ?? []).slice(index + 1).some((later) => later.effect?.action === DROPPED && sameObject(effect, later.effect));

  const targetOf = (effect: StatementEffect | null, index: number): DatabaseObjectRef | null =>
    openable && effect?.name && effect.action !== DROPPED && OPENABLE.includes(effect.object) && !droppedAfter(effect, index)
      ? {
          connection: query.connection,
          database: query.database,
          schema: effect.schema,
          name: effect.name,
          kind: effect.object === "view" ? "view" : "table",
        }
      : null;

  const targets = $derived.by(() => {
    const found: DatabaseObjectRef[] = [];
    (statements ?? []).forEach((statement, index) => {
      const target = targetOf(statement.effect, index);
      if (target && !found.some((known) => known.kind === target.kind && known.schema === target.schema && known.name === target.name)) {
        found.push(target);
      }
    });
    return found;
  });

  const reveal = (target: DatabaseObjectRef) => {
    if (query.writes) databases.forget(backend.active, query.connection);
    screenFor("databases").open();
    openDatabaseObject(target);
  };

  const openConsole = () => {
    const scope = { connection: query.connection, database: query.database };
    databases.saveDraft(backend.active, scope, { sql: query.sql });
    reveal({ ...scope, schema: null, name: "", kind: "console" });
  };
</script>

<Collapsible
  {label}
  icon={DATABASES_ICON}
  tone="action"
  preview={query.sql}
  stat={running || !last ? null : countOf(last)}
  labelOnly={!query.sql.trim()}
  {running}
  {expanded}
  {onToggle}
>
  <div class="chat-gap flex flex-col">
    <CodeBlock code={query.sql} lang={SQL_LANG} capped />
    {#each statements ?? [] as statement, index (index)}
      <p class="text-body-sm text-on-surface-variant">{summaryOf(statement)}</p>
      {#if statement.columns && statement.rows?.length}
        <div class={FRAME}>
          <DataGrid columns={statement.columns} rows={statement.rows} />
        </div>
      {:else if statement.structure?.length}
        <div class={FRAME}>
          <div use:viewportScrollbar class="{TEXT_VIEWPORT_CLASS} scrollbar-thin selectable min-h-0 flex-1 overflow-auto px-1">
            <ColumnsTable columns={statement.structure} />
          </div>
        </div>
      {/if}
    {/each}
    {#if failure}
      <CodeBlock code={failure} lang={t("RESULT")} />
    {/if}
    {#if targets.length}
      <div class="flex flex-wrap items-center gap-1.5">
        {#each targets as target (`${target.kind}|${target.schema}|${target.name}`)}
          <Chip
            name={qualifiedName(target.schema, target.name)}
            icon={target.kind === "view" ? View : Table2}
            onclick={() => reveal(target)}
          />
        {/each}
      </div>
    {/if}
    {#if openable && !query.writes}
      <div class="flex flex-wrap gap-2">
        <Button variant="outlined" small onclick={openConsole}>{t("DATABASE_NEW_CONSOLE")}</Button>
      </div>
    {/if}
  </div>
</Collapsible>
