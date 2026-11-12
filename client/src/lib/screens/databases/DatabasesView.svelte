<script lang="ts">
  import Database from "@lucide/svelte/icons/database";
  import Download from "@lucide/svelte/icons/download";
  import EllipsisVertical from "@lucide/svelte/icons/ellipsis-vertical";
  import Pencil from "@lucide/svelte/icons/pencil";
  import Plug from "@lucide/svelte/icons/plug";
  import Plus from "@lucide/svelte/icons/plus";
  import RotateCw from "@lucide/svelte/icons/rotate-cw";
  import SquareCode from "@lucide/svelte/icons/square-code";
  import Trash2 from "@lucide/svelte/icons/trash-2";
  import { untrack } from "svelte";
  import { navigation } from "$lib/app/navigation.svelte";
  import { closeDatabaseObject, openDatabaseObject, openedObject } from "$lib/app/viewer.svelte";
  import {
    databaseFailureText,
    EXPORT_FORMATS,
    SQL_QUOTE,
    sqlIdentifier,
    type DatabaseConnection,
    type DatabaseScope,
    type ExportFormat,
  } from "$lib/data/databaseModels";
  import { KeyGate, keyRefused } from "$lib/data/keyGate.svelte";
  import { securityKeys } from "$lib/data/securityKeys.svelte";
  import { serverStatus } from "$lib/data/serverStatus.svelte";
  import { t } from "$lib/i18n/index.svelte";
  import { isTouch } from "$lib/platform";
  import { layout } from "$lib/platform/layout.svelte";
  import PaneHeader from "$lib/screens/chat/PaneHeader.svelte";
  import { backend } from "$lib/services/backend.svelte";
  import { databases } from "$lib/services/databases.svelte";
  import { createDatabasesApi } from "$lib/services/databasesApi";
  import ActionButton from "$lib/ui/ActionButton.svelte";
  import CenteredProgress from "$lib/ui/CenteredProgress.svelte";
  import ConfirmDialog from "$lib/ui/ConfirmDialog.svelte";
  import ConnectionError from "$lib/ui/ConnectionError.svelte";
  import EmptyState from "$lib/ui/EmptyState.svelte";
  import ErrorText from "$lib/ui/ErrorText.svelte";
  import LinearProgress from "$lib/ui/LinearProgress.svelte";
  import MenuItem from "$lib/ui/MenuItem.svelte";
  import PopupMenu from "$lib/ui/PopupMenu.svelte";
  import ScrollCard from "$lib/ui/ScrollCard.svelte";
  import SecurityKeyDialog from "$lib/ui/SecurityKeyDialog.svelte";
  import ServerUnavailable from "$lib/ui/ServerUnavailable.svelte";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";
  import ConnectionDialog from "./ConnectionDialog.svelte";
  import DatabaseObjectView from "./DatabaseObjectView.svelte";
  import DatabaseTree, { type TreeMenuTarget } from "./DatabaseTree.svelte";
  import DriversDialog from "./DriversDialog.svelte";
  import { deliverExport } from "./exportDelivery";

  interface Props {
    elsewhere?: boolean;
  }

  const { elsewhere = false }: Props = $props();

  const LIST_FRAME = "flex-1 rounded-panel";

  const api = createDatabasesApi(() => backend.active);
  const gate = new KeyGate();

  let adding = $state(false);
  let editing = $state<DatabaseConnection | null>(null);
  let managing = $state(false);
  let removing = $state<DatabaseConnection | null>(null);
  let menuId = $state<string | null>(null);
  let failed = $state<string | null>(null);
  let exporting = $state(false);
  let unlocking = $state(false);
  let rejected = $state(false);

  const profile = $derived(backend.active);
  const listed = $derived(databases.listOf(profile));
  const locked = $derived(securityKeys.unlocked(profile) === false);
  const connections = $derived(listed?.connections ?? []);
  const expandable = $derived(!layout.mobile);
  const fullObject = $derived(openedObject.full && expandable);
  const showingObject = $derived(openedObject.connection !== null && !elsewhere);

  $effect(() => {
    if (!listed && !serverStatus.unavailable) void databases.refresh(profile);
  });

  let environment = untrack(() => backend.activeId);

  $effect(() => {
    const next = backend.activeId;
    if (next === environment) return;
    environment = next;
    untrack(closeDatabaseObject);
  });

  $effect(() => {
    const id = openedObject.connection;
    if (id && listed && !databases.find(profile, id)) untrack(closeDatabaseObject);
  });

  $effect(() =>
    showingObject
      ? navigation.intercept(() => {
          closeDatabaseObject();
          return true;
        })
      : undefined,
  );

  const refreshAll = async () => {
    for (const connection of connections) databases.forget(profile, connection.id);
    await databases.refresh(profile);
  };

  const exportable = (connection: DatabaseConnection) =>
    databases.schemasOf(profile, { connection: connection.id, database: null })?.value?.databases === null;

  const EXPORT_LABELS: Record<ExportFormat, string> = { csv: "DATABASE_EXPORT_CSV", sql: "DATABASE_EXPORT_SQL" };

  const deliver = async (found: Promise<Awaited<ReturnType<typeof api.exportDump>>>) => {
    menuId = null;
    failed = null;
    exporting = true;
    const problem = await deliverExport(await found);
    exporting = false;
    if (problem) failed = databaseFailureText(problem.failure);
  };

  const exportDump = (scope: DatabaseScope, schema: string | null) => deliver(api.exportDump(scope, schema));

  const exportObject = (scope: DatabaseScope, schema: string | null, name: string, format: ExportFormat) =>
    deliver(api.exportTable(scope, { schema, name, sort: null, descending: false, where: "" }, format));

  const queryInConsole = (scope: DatabaseScope, schema: string | null, name: string) => {
    menuId = null;
    const engine = databases.engine(profile, databases.find(profile, scope.connection)?.engine ?? "");
    const quote = engine?.quote ?? SQL_QUOTE;
    const table = [schema, name].filter((part) => part !== null).map((part) => sqlIdentifier(part, quote));
    databases.saveDraft(profile, scope, { sql: `SELECT * FROM ${table.join(".")};` });
    openDatabaseObject({ connection: scope.connection, database: scope.database, schema: null, name: "", kind: "console" });
  };

  const remove = async (connection: DatabaseConnection) => {
    removing = null;
    failed = null;
    const result = await gate.run((key) => api.remove(connection.id, key));
    if (!result.ok) {
      if (!keyRefused(result)) failed = databaseFailureText(result.failure);
      return;
    }
    if (openedObject.connection === connection.id) closeDatabaseObject();
    await databases.refresh(profile);
    databases.setExpanded(profile, false, connection.id);
    databases.forget(profile, connection.id);
  };

  const askKey = () => {
    rejected = false;
    unlocking = true;
  };

  const unlocked = (action: () => void) => () => (locked ? askKey() : action());

  const unlock = async (key: string) => {
    if (!(await databases.refresh(profile, key))) {
      rejected = true;
      return;
    }
    securityKeys.set(key);
    unlocking = false;
    rejected = false;
  };

  const openConsole = (connection: DatabaseConnection) => {
    menuId = null;
    openDatabaseObject({ connection: connection.id, database: null, schema: null, name: "", kind: "console" });
  };
</script>

{#snippet headerActions()}
  <TooltipIconButton label={t("DATABASE_ADD_CONNECTION")} onclick={unlocked(() => (adding = true))}>
    <Plus />
  </TooltipIconButton>
  <TooltipIconButton label={t("DATABASE_DRIVERS")} onclick={unlocked(() => (managing = true))}>
    <Plug />
  </TooltipIconButton>
  <TooltipIconButton label={t("REFRESH")} enabled={!!listed} onclick={() => void refreshAll()}>
    <RotateCw />
  </TooltipIconButton>
{/snippet}

{#snippet unlockAction()}
  <ActionButton text={t("UNLOCK")} onclick={askKey} />
{/snippet}

{#snippet exportItem(scope: DatabaseScope, schema: string | null)}
  <MenuItem icon={Download} text={t("DATABASE_EXPORT_SQL")} enabled={!exporting} onclick={() => void exportDump(scope, schema)} />
{/snippet}

{#snippet treeMenu(target: TreeMenuTarget)}
  <div class="absolute top-1 right-1 {isTouch || menuId === target.key ? '' : 'opacity-0 group-hover:opacity-100'}">
    <PopupMenu
      open={menuId === target.key}
      onOpenChange={(open) => (menuId = open ? target.key : null)}
      label={t("MORE_OPTIONS")}
      align="end"
    >
      {#snippet triggerChild(props)}
        <TooltipIconButton label={t("MORE_OPTIONS")} tooltip={false} class="size-6" {...props}>
          <EllipsisVertical />
        </TooltipIconButton>
      {/snippet}
      {#if target.kind === "connection"}
        {@const connection = target.connection}
        <MenuItem icon={SquareCode} text={t("DATABASE_NEW_CONSOLE")} onclick={() => openConsole(connection)} />
        <MenuItem icon={Pencil} text={t("EDIT")} onclick={() => (editing = connection)} />
        <MenuItem icon={RotateCw} text={t("REFRESH")} onclick={() => databases.forget(profile, connection.id)} />
        {#if exportable(connection)}
          {@render exportItem({ connection: connection.id, database: null }, null)}
        {/if}
        <MenuItem icon={Trash2} danger text={t("DELETE")} onclick={() => (removing = connection)} />
      {:else if target.kind === "database"}
        {@render exportItem(target.scope, null)}
      {:else if target.kind === "schema"}
        {@render exportItem(target.scope, target.schema)}
      {:else}
        <MenuItem
          icon={SquareCode}
          text={t("DATABASE_QUERY_IN_CONSOLE")}
          onclick={() => queryInConsole(target.scope, target.schema, target.name)}
        />
        {#each EXPORT_FORMATS as format (format)}
          <MenuItem
            icon={Download}
            text={t(EXPORT_LABELS[format])}
            enabled={!exporting}
            onclick={() => void exportObject(target.scope, target.schema, target.name, format)}
          />
        {/each}
      {/if}
    </PopupMenu>
  </div>
{/snippet}

<div class="relative flex h-full min-h-0 flex-col">
  {#if exporting}
    <LinearProgress class="absolute inset-x-0 top-0 z-30" />
  {/if}
  <PaneHeader title={t("DATABASES")} actions={headerActions} />
  <div class="flex min-h-0 flex-1 flex-col gap-2 px-(--page-inset) pb-(--page-inset)">
    {#if failed}
      <ErrorText text={failed} class="shrink-0 px-1" />
    {/if}
    {#if serverStatus.unavailable}
      <ServerUnavailable class="min-h-0 flex-1" />
    {:else if !listed && !databases.failed(profile)}
      <CenteredProgress class="min-h-0 flex-1" />
    {:else if !listed}
      <ConnectionError class="min-h-0 flex-1" />
    {:else if locked}
      <EmptyState icon={Database} text={t("DATABASES_LOCKED")} action={unlockAction} class="min-h-0 flex-1" />
    {:else if !connections.length}
      <EmptyState icon={Database} text={t("DATABASES_NONE")} class="min-h-0 flex-1">
        {#snippet action()}
          <ActionButton text={t("DATABASE_ADD_CONNECTION")} onclick={() => (adding = true)} />
        {/snippet}
      </EmptyState>
    {:else}
      <ScrollCard frame={LIST_FRAME} memory={`databases|${backend.activeId ?? ""}`}>
        <DatabaseTree
          {connections}
          selected={openedObject}
          {gate}
          onOpen={openDatabaseObject}
          onError={(text) => (failed = text)}
          onMenu={(target) => (menuId = target.key)}
          menu={treeMenu}
        />
      </ScrollCard>
    {/if}
  </div>

  {#if showingObject && openedObject.connection}
    <div class={fullObject ? "" : "absolute inset-0 z-10"}>
      <DatabaseObjectView
        connection={openedObject.connection}
        database={openedObject.database}
        schema={openedObject.schema}
        name={openedObject.name}
        kind={openedObject.kind}
        embedded={!fullObject}
        onExpand={expandable && !fullObject ? () => (openedObject.full = true) : null}
        onClose={closeDatabaseObject}
      />
    </div>
  {/if}
</div>

{#if adding || editing}
  <ConnectionDialog
    connection={editing}
    {gate}
    onDismiss={() => {
      adding = false;
      editing = null;
    }}
  />
{/if}

{#if managing}
  <DriversDialog {gate} onDismiss={() => (managing = false)} />
{/if}

{#if removing}
  {@const target = removing}
  <ConfirmDialog
    title={t("DELETE")}
    text={t("DATABASE_REMOVE_CONFIRM", target.name)}
    confirmLabel={t("DELETE")}
    danger
    onConfirm={() => void remove(target)}
    onDismiss={() => (removing = null)}
  />
{/if}

{#if gate.asking}
  <SecurityKeyDialog rejected={gate.rejected} onConfirm={(key) => gate.confirm(key)} onDismiss={() => gate.dismiss()} />
{/if}

{#if unlocking}
  <SecurityKeyDialog
    title={t("DATABASES_LOCKED")}
    {rejected}
    onConfirm={(key) => void unlock(key)}
    onDismiss={() => {
      unlocking = false;
      rejected = false;
    }}
  />
{/if}
