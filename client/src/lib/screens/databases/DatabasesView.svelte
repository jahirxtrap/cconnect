<script lang="ts">
  import Database from "@lucide/svelte/icons/database";
  import EllipsisVertical from "@lucide/svelte/icons/ellipsis-vertical";
  import Pencil from "@lucide/svelte/icons/pencil";
  import Plug from "@lucide/svelte/icons/plug";
  import Plus from "@lucide/svelte/icons/plus";
  import RefreshCw from "@lucide/svelte/icons/refresh-cw";
  import SquareCode from "@lucide/svelte/icons/square-code";
  import Trash2 from "@lucide/svelte/icons/trash-2";
  import { untrack } from "svelte";
  import { navigation } from "$lib/app/navigation.svelte";
  import { closeDatabaseObject, openDatabaseObject, openedObject } from "$lib/app/viewer.svelte";
  import { databaseFailureText, type DatabaseConnection } from "$lib/data/databaseModels";
  import { KeyGate, keyRefused } from "$lib/data/keyGate.svelte";
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
  import MenuItem from "$lib/ui/MenuItem.svelte";
  import PopupMenu from "$lib/ui/PopupMenu.svelte";
  import ScrollCard from "$lib/ui/ScrollCard.svelte";
  import SecurityKeyDialog from "$lib/ui/SecurityKeyDialog.svelte";
  import ServerUnavailable from "$lib/ui/ServerUnavailable.svelte";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";
  import ConnectionDialog from "./ConnectionDialog.svelte";
  import DatabaseObjectView from "./DatabaseObjectView.svelte";
  import DatabaseTree from "./DatabaseTree.svelte";
  import DriversDialog from "./DriversDialog.svelte";

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

  const profile = $derived(backend.active);
  const listed = $derived(databases.listOf(profile));
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

  const openConsole = (connection: DatabaseConnection) => {
    menuId = null;
    openDatabaseObject({ connection: connection.id, database: null, schema: null, name: "", kind: "console" });
  };
</script>

{#snippet headerActions()}
  <TooltipIconButton label={t("DATABASE_ADD_CONNECTION")} onclick={() => (adding = true)}>
    <Plus />
  </TooltipIconButton>
  <TooltipIconButton label={t("DATABASE_DRIVERS")} onclick={() => (managing = true)}>
    <Plug />
  </TooltipIconButton>
  <TooltipIconButton label={t("REFRESH")} enabled={!!listed} onclick={() => void refreshAll()}>
    <RefreshCw />
  </TooltipIconButton>
{/snippet}

{#snippet connectionMenu(connection: DatabaseConnection)}
  <div class="absolute top-1 right-1 {isTouch || menuId === connection.id ? '' : 'opacity-0 group-hover:opacity-100'}">
    <PopupMenu
      open={menuId === connection.id}
      onOpenChange={(open) => (menuId = open ? connection.id : null)}
      label={t("MORE_OPTIONS")}
      align="end"
    >
      {#snippet triggerChild(props)}
        <TooltipIconButton label={t("MORE_OPTIONS")} tooltip={false} class="size-6" {...props}>
          <EllipsisVertical />
        </TooltipIconButton>
      {/snippet}
      <MenuItem icon={SquareCode} text={t("DATABASE_NEW_CONSOLE")} onclick={() => openConsole(connection)} />
      <MenuItem icon={Pencil} text={t("EDIT")} onclick={() => (editing = connection)} />
      <MenuItem icon={RefreshCw} text={t("REFRESH")} onclick={() => databases.forget(profile, connection.id)} />
      <MenuItem icon={Trash2} danger text={t("DELETE")} onclick={() => (removing = connection)} />
    </PopupMenu>
  </div>
{/snippet}

<div class="relative flex h-full min-h-0 flex-col">
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
          onMenu={(connection) => (menuId = connection.id)}
          menu={connectionMenu}
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
  <DriversDialog onDismiss={() => (managing = false)} />
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
