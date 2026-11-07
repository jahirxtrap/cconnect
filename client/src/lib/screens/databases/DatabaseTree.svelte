<script lang="ts">
  import ChevronRight from "@lucide/svelte/icons/chevron-right";
  import Database from "@lucide/svelte/icons/database";
  import DatabaseZap from "@lucide/svelte/icons/database-zap";
  import Layers from "@lucide/svelte/icons/layers";
  import Lock from "@lucide/svelte/icons/lock";
  import SquareCode from "@lucide/svelte/icons/square-code";
  import Table2 from "@lucide/svelte/icons/table-2";
  import View from "@lucide/svelte/icons/view";
  import { untrack, type Snippet } from "svelte";
  import { sameObject, type DatabaseObjectKind, type DatabaseObjectRef, type OpenedObject } from "$lib/app/viewer.svelte";
  import {
    databaseFailureText,
    engineLabel,
    type DatabaseConnection,
    type DatabaseFailure,
    type DatabaseScope,
  } from "$lib/data/databaseModels";
  import { formatDecimal } from "$lib/data/format";
  import type { KeyGate } from "$lib/data/keyGate.svelte";
  import { t } from "$lib/i18n/index.svelte";
  import { backend } from "$lib/services/backend.svelte";
  import { databases } from "$lib/services/databases.svelte";
  import ActionButton from "$lib/ui/ActionButton.svelte";
  import ErrorText from "$lib/ui/ErrorText.svelte";
  import type { IconSource } from "$lib/ui/icons";
  import Pressable from "$lib/ui/Pressable.svelte";

  interface Props {
    connections: DatabaseConnection[];
    rooted?: boolean;
    selected: OpenedObject | DatabaseObjectRef | null;
    gate: KeyGate;
    onOpen: (target: DatabaseObjectRef) => void;
    onError: (text: string) => void;
    onMenu?: (connection: DatabaseConnection) => void;
    menu?: Snippet<[DatabaseConnection]>;
  }

  const { connections, rooted = true, selected, gate, onOpen, onError, onMenu, menu }: Props = $props();

  const INDENT = 14;
  const LABEL_INSET = 30;
  const ROW_BASE = "flex h-8 w-full items-center gap-1.5 rounded-md text-left";
  const ROW_CLASS = `${ROW_BASE} px-2`;
  const MENU_ROW_CLASS = `${ROW_BASE} pr-8 pl-2`;
  const GROUPS = ["tables", "views"] as const;

  type Group = (typeof GROUPS)[number];

  const GROUP_LABELS: Record<Group, string> = { tables: "DATABASE_TABLES", views: "DATABASE_VIEWS" };
  const GROUP_KINDS: Record<Group, DatabaseObjectKind> = { tables: "table", views: "view" };
  const KIND_ICONS: Record<DatabaseObjectKind, IconSource> = { table: Table2, view: View, console: SquareCode };

  interface Placed {
    connection: DatabaseConnection;
    scope: DatabaseScope;
    depth: number;
  }

  type Row = { key: string } & Placed &
    (
      | { type: "connection" }
      | { type: "console" }
      | { type: "database"; database: string }
      | { type: "schema"; schema: string }
      | { type: "group"; schema: string | null; group: Group; count: number }
      | { type: "object"; schema: string | null; name: string; kind: DatabaseObjectKind }
      | { type: "empty" }
      | { type: "failure"; failure: DatabaseFailure | null }
    );

  interface Pending {
    scope: DatabaseScope;
    schema?: string | null;
  }

  let busy = $state(false);

  const profile = $derived(backend.active);

  const isOpen = (...path: (string | null)[]) => databases.expanded(profile, ...path);

  const toggle = (...path: (string | null)[]) => databases.setExpanded(profile, !isOpen(...path), ...path);

  const keyOf = (type: Row["type"], scope: DatabaseScope, ...parts: (string | null)[]) =>
    JSON.stringify([type, scope.connection, scope.database, ...parts]);

  const tree = $derived.by(() => {
    const rows: Row[] = [];
    const pending: Pending[] = [];
    const settled = <T,>(
      loaded: { value: T | null; failure: DatabaseFailure | null; loading: boolean } | null,
      place: Placed,
      need: Pending,
    ): T | null => {
      const path = need.schema === undefined ? [] : [need.schema];
      if (!loaded) pending.push(need);
      if (!loaded || (loaded.loading && !loaded.value)) return null;
      if (!loaded.value) {
        rows.push({ type: "failure", ...place, key: keyOf("failure", place.scope, ...path), failure: loaded.failure });
      }
      return loaded.value;
    };
    const objectsOf = (connection: DatabaseConnection, scope: DatabaseScope, schema: string | null, depth: number) => {
      const place = { connection, scope, depth };
      const found = settled(databases.objectsOf(profile, scope, schema), place, { scope, schema });
      if (!found) return;
      if (!found.tables.length && !found.views.length) rows.push({ type: "empty", ...place, key: keyOf("empty", scope, schema) });
      for (const group of GROUPS) {
        const names = found[group];
        if (!names.length) continue;
        rows.push({ type: "group", ...place, key: keyOf("group", scope, schema, group), schema, group, count: names.length });
        if (!isOpen(scope.connection, scope.database, schema, group)) continue;
        for (const name of names) {
          rows.push({
            type: "object",
            ...place,
            key: keyOf("object", scope, schema, group, name),
            schema,
            name,
            kind: GROUP_KINDS[group],
            depth: depth + 1,
          });
        }
      }
    };
    const catalog = (connection: DatabaseConnection, scope: DatabaseScope, depth: number) => {
      const place = { connection, scope, depth };
      rows.push({ type: "console", ...place, key: keyOf("console", scope) });
      const found = settled(databases.schemasOf(profile, scope), place, { scope });
      if (!found) return;
      if (found.databases) {
        for (const database of found.databases) {
          rows.push({ type: "database", ...place, key: keyOf("database", scope, database), database });
          if (isOpen(connection.id, database)) catalog(connection, { connection: connection.id, database }, depth + 1);
        }
        return;
      }
      const { schemas, default: fallback } = found;
      if (schemas.length <= 1) {
        objectsOf(connection, scope, schemas[0] && schemas[0] !== fallback ? schemas[0] : null, depth);
        return;
      }
      for (const schema of schemas) {
        rows.push({ type: "schema", ...place, key: keyOf("schema", scope, schema), schema });
        if (isOpen(scope.connection, scope.database, schema)) objectsOf(connection, scope, schema, depth + 1);
      }
    };
    for (const connection of connections) {
      const scope = { connection: connection.id, database: null };
      if (!rooted) {
        catalog(connection, scope, 0);
        continue;
      }
      rows.push({ type: "connection", key: keyOf("connection", scope), connection, scope, depth: 0 });
      if (isOpen(connection.id)) catalog(connection, scope, 1);
    }
    return { rows, pending };
  });

  $effect(() => {
    const target = profile;
    for (const need of tree.pending) {
      untrack(() =>
        need.schema === undefined
          ? databases.loadSchemas(target, need.scope)
          : databases.loadObjects(target, need.scope, need.schema),
      );
    }
  });

  const installDriver = async (connection: DatabaseConnection) => {
    busy = true;
    const failed = await databases.installDriver(profile, connection, gate);
    busy = false;
    if (failed) onError(failed);
  };

  const target = (row: Extract<Row, { type: "object" | "console" }>): DatabaseObjectRef => ({
    connection: row.connection.id,
    database: row.scope.database,
    schema: row.type === "object" ? row.schema : null,
    name: row.type === "object" ? row.name : "",
    kind: row.type === "object" ? row.kind : "console",
  });

  const current = (row: Extract<Row, { type: "object" | "console" }>) => sameObject(selected, target(row));
</script>

{#snippet chevron(depth: number, open: boolean, folds: boolean)}
  <span style="margin-left: {depth * INDENT}px" class="flex size-4 shrink-0 items-center justify-center">
    {#if folds}
      <ChevronRight size={14} class="text-on-surface-variant {open ? 'rotate-90' : ''}" />
    {/if}
  </span>
{/snippet}

{#snippet label(Icon: IconSource, text: string)}
  <Icon size={16} class="shrink-0 text-on-surface-variant" />
  <span class="min-w-0 flex-1 truncate text-body-md">{text}</span>
{/snippet}

{#snippet row(item: Row)}
  {#if item.type === "connection"}
    {@const engine = databases.engine(profile, item.connection.engine)}
    <div class="group relative">
      <Pressable
        onclick={() => toggle(item.connection.id)}
        onlongclick={onMenu ? () => onMenu(item.connection) : undefined}
        oncontextmenu={onMenu ? () => onMenu(item.connection) : undefined}
        class={menu ? MENU_ROW_CLASS : ROW_CLASS}
      >
        {@render chevron(0, isOpen(item.connection.id), true)}
        {@render label(DatabaseZap, item.connection.name)}
        {#if item.connection.readOnly}
          <Lock size={12} class="shrink-0 text-on-surface-variant" />
        {/if}
        <span class="shrink-0 text-caption text-faint">{engineLabel(engine, item.connection.engine)}</span>
      </Pressable>
      {@render menu?.(item.connection)}
    </div>
  {:else if item.type === "console" || item.type === "object"}
    {@const chosen = current(item)}
    <Pressable onclick={() => onOpen(target(item))} hover={!chosen} class="{ROW_CLASS} {chosen ? 'bg-surface-variant' : ''}">
      {@render chevron(item.depth, false, false)}
      {@render label(KIND_ICONS[target(item).kind], item.type === "console" ? t("DATABASE_CONSOLE") : item.name)}
    </Pressable>
  {:else if item.type === "database"}
    <Pressable onclick={() => toggle(item.connection.id, item.database)} class={ROW_CLASS}>
      {@render chevron(item.depth, isOpen(item.connection.id, item.database), true)}
      {@render label(Database, item.database)}
    </Pressable>
  {:else if item.type === "schema"}
    <Pressable onclick={() => toggle(item.scope.connection, item.scope.database, item.schema)} class={ROW_CLASS}>
      {@render chevron(item.depth, isOpen(item.scope.connection, item.scope.database, item.schema), true)}
      {@render label(Layers, item.schema)}
    </Pressable>
  {:else if item.type === "group"}
    {@const open = isOpen(item.scope.connection, item.scope.database, item.schema, item.group)}
    <Pressable onclick={() => toggle(item.scope.connection, item.scope.database, item.schema, item.group)} class={ROW_CLASS}>
      {@render chevron(item.depth, open, true)}
      {@render label(KIND_ICONS[GROUP_KINDS[item.group]], t(GROUP_LABELS[item.group]))}
      <span class="shrink-0 text-caption text-faint">{formatDecimal(item.count, 0)}</span>
    </Pressable>
  {:else if item.type === "empty"}
    <div style="padding-left: {item.depth * INDENT + LABEL_INSET}px" class="flex h-8 items-center text-body-sm text-faint">
      {t("DATABASE_NO_TABLES")}
    </div>
  {:else}
    {@const failing = item.connection}
    <div style="padding-left: {item.depth * INDENT + LABEL_INSET}px" class="flex flex-col items-start gap-1.5 py-1.5 pr-2">
      <ErrorText text={databaseFailureText(item.failure)} />
      <div class="flex gap-2">
        {#if item.failure?.reason === "driver" && (!failing.url || failing.packages.length)}
          <ActionButton text={t("DATABASE_INSTALL_DRIVER")} enabled={!busy} onclick={() => void installDriver(failing)} />
        {/if}
        <ActionButton text={t("RETRY")} enabled={!busy} onclick={() => databases.forget(profile, failing.id)} />
      </div>
    </div>
  {/if}
{/snippet}

{#each tree.rows as item (item.key)}
  {@render row(item)}
{/each}
