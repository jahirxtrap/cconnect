<script lang="ts">
  import ArrowLeft from "@lucide/svelte/icons/arrow-left";
  import Check from "@lucide/svelte/icons/check";
  import Download from "@lucide/svelte/icons/download";
  import Eraser from "@lucide/svelte/icons/eraser";
  import Info from "@lucide/svelte/icons/info";
  import ListFilter from "@lucide/svelte/icons/list-filter";
  import Maximize2 from "@lucide/svelte/icons/maximize-2";
  import Play from "@lucide/svelte/icons/play";
  import Plus from "@lucide/svelte/icons/plus";
  import RotateCw from "@lucide/svelte/icons/rotate-cw";
  import Table2 from "@lucide/svelte/icons/table-2";
  import { untrack } from "svelte";
  import type { DatabaseObjectKind } from "$lib/app/viewer.svelte";
  import {
    databaseFailureText,
    EXPORT_FORMATS,
    kindsOfValues,
    qualifiedName,
    statementSummary,
    type ColumnKind,
    type DatabaseFailure,
    type DatabaseScope,
    type ExportFormat,
    type TableQuery,
  } from "$lib/data/databaseModels";
  import { formatDecimal, formatDuration, joined } from "$lib/data/format";
  import { holdRefresh } from "$lib/data/inflight";
  import { KeyGate, keyRefused } from "$lib/data/keyGate.svelte";
  import { t } from "$lib/i18n/index.svelte";
  import { shortcuts, signature } from "$lib/platform/shortcuts.svelte";
  import CenterViewToggle from "$lib/screens/chat/CenterViewToggle.svelte";
  import { FULL_INSET_CLASS } from "$lib/screens/chat/paneChrome";
  import PaneHeader from "$lib/screens/chat/PaneHeader.svelte";
  import { paneRole } from "$lib/screens/chat/paneSurface";
  import { backend } from "$lib/services/backend.svelte";
  import { databases, type TableView } from "$lib/services/databases.svelte";
  import { createDatabasesApi, type DatabaseOutcome } from "$lib/services/databasesApi";
  import { deliverExport } from "./exportDelivery";
  import { BAR_DOCK_CLASS, BAR_REGION_CLASS } from "$lib/ui/actionBar";
  import ActionButton from "$lib/ui/ActionButton.svelte";
  import AppTopBar from "$lib/ui/AppTopBar.svelte";
  import CenteredProgress from "$lib/ui/CenteredProgress.svelte";
  import EmptyState from "$lib/ui/EmptyState.svelte";
  import ErrorText from "$lib/ui/ErrorText.svelte";
  import InputField from "$lib/ui/InputField.svelte";
  import LinearProgress from "$lib/ui/LinearProgress.svelte";
  import MenuItem from "$lib/ui/MenuItem.svelte";
  import PopupMenu from "$lib/ui/PopupMenu.svelte";
  import SearchBar from "$lib/ui/SearchBar.svelte";
  import SecurityKeyDialog from "$lib/ui/SecurityKeyDialog.svelte";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";
  import DataGrid from "./DataGrid.svelte";
  import GridBar from "./GridBar.svelte";
  import RowDialog from "./RowDialog.svelte";
  import RowsPager from "./RowsPager.svelte";
  import TableInfoPanel from "./TableInfoPanel.svelte";

  interface Props {
    connection: string;
    database: string | null;
    schema: string | null;
    name: string;
    kind: DatabaseObjectKind;
    embedded?: boolean;
    onExpand?: (() => void) | null;
    onClose: () => void;
  }

  const { connection, database, schema, name, kind, embedded = false, onExpand = null, onClose }: Props = $props();

  const EXPORT_LABELS: Record<ExportFormat, string> = { csv: "DATABASE_EXPORT_CSV", sql: "DATABASE_EXPORT_SQL" };
  const BODY_CLASS = "flex min-h-0 flex-1 flex-col gap-2 px-(--page-inset)";
  const CARD_CLASS = "relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-panel bg-card";

  const api = createDatabasesApi(() => backend.active);
  const gate = new KeyGate();
  const centered = paneRole() === "center";
  const RUN_SHORTCUT = "databases.run";

  const profile = $derived(backend.active);
  const listed = $derived(databases.listOf(profile));
  const entry = $derived(databases.find(profile, connection));
  const scope = $derived<DatabaseScope>({ connection, database });
  const consoleView = $derived(kind === "console");
  const title = $derived(consoleView ? joined(t("DATABASE_CONSOLE"), database) : qualifiedName(database, schema, name));

  let failure = $state<string | null>(null);
  let loading = $state(false);
  let whereDraft = $state("");
  let showInfo = $state(false);
  let editing = $state<number | null>(null);
  let adding = $state(false);
  let exportMenu = $state(false);
  let exporting = $state(false);
  let running = $state(false);
  let run = 0;

  const draft = $derived(databases.draftOf(profile, scope));
  const sql = $derived(draft.sql);
  const result = $derived(draft.result);
  const view = $derived(databases.tableViewOf(profile, scope, schema, name));
  const info = $derived(view.info);
  const rows = $derived(view.rows);
  const page = $derived(view.page);
  const sort = $derived(view.sort);
  const descending = $derived(view.descending);
  const where = $derived(view.where);
  const keep = (next: Partial<TableView>) => databases.saveTableView(profile, scope, schema, name, next);
  const kinds = $derived(Object.fromEntries((info?.columns ?? []).map((column) => [column.name, column.kind])) as Record<string, ColumnKind>);
  const query = $derived<TableQuery>({ schema, name, sort, descending, where });
  const pageSize = $derived(view.size || listed?.pageSize || 0);
  const exportable = $derived(!!result?.rows && result.statements === 1 && !result.wrote && !!draft.ran.trim());

  const report = (found: DatabaseFailure | null) => {
    failure = databaseFailureText(found);
  };

  const load = async (describe = false) => {
    const current = ++run;
    const target = query;
    loading = true;
    const fetching = Promise.all([
      info && !describe ? Promise.resolve(null) : api.table(scope, schema, name),
      api.browse(scope, target, page, pageSize),
    ]);
    const held = holdRefresh(fetching);
    const [table, found] = await fetching;
    if (current === run) {
      if (table && table.ok) keep({ info: table.value });
      if (table && !table.ok) report(table.failure);
      else if (!found.ok) report(found.failure);
      else {
        failure = null;
        keep({ rows: found.value, page: found.value.page });
      }
    }
    await held;
    if (current === run) loading = false;
  };

  const reload = () => void load(true);

  $effect(() => {
    void connection;
    void database;
    void schema;
    void name;
    void kind;
    untrack(() => {
      run++;
      failure = null;
      whereDraft = view.where;
      editing = null;
      adding = false;
    });
  });

  $effect(() => {
    if (kind !== "console" && view.rows === null) untrack(() => void load());
  });

  const goTo = (next: number) => {
    keep({ page: next });
    void load();
  };

  const resize = (next: number) => {
    keep({ size: next, page: 1 });
    void load();
  };

  const sortBy = (column: string) => {
    if (sort !== column) keep({ sort: column, descending: false, page: 1 });
    else if (!descending) keep({ descending: true, page: 1 });
    else keep({ sort: null, descending: false, page: 1 });
    void load();
  };

  const applyWhere = (value: string) => {
    whereDraft = value;
    keep({ where: value.trim(), page: 1 });
    void load();
  };

  const download = async (found: DatabaseOutcome<string>) => {
    exporting = false;
    const problem = await deliverExport(found);
    if (problem) report(problem.failure);
  };

  const exportTable = async (format: ExportFormat) => {
    exportMenu = false;
    exporting = true;
    await download(await api.exportTable(scope, query, format));
  };

  const exportQuery = async () => {
    exporting = true;
    await download(await api.exportQuery(scope, draft.ran));
  };

  const setSql = (value: string) => databases.saveDraft(profile, scope, { sql: value });

  const execute = async () => {
    const text = sql.trim();
    if (!text || running) return;
    running = true;
    const querying = gate.run((key) => api.query(scope, text, key));
    const held = holdRefresh(querying);
    const found = await querying;
    if (!found.ok) {
      if (!keyRefused(found)) report(found.failure);
    } else {
      failure = null;
      databases.saveDraft(profile, scope, { result: found.value, ran: text });
      if (found.value.wrote) databases.forget(profile, connection);
    }
    await held;
    running = false;
  };

  const clear = () => {
    setSql("");
    failure = null;
    databases.saveDraft(profile, scope, { result: null, ran: "" });
  };

  const onSqlKey = (event: KeyboardEvent) => {
    if (shortcuts.idFor(signature(event), ["databases"]) !== RUN_SHORTCUT) return;
    event.preventDefault();
    void execute();
  };

  const typeWhere = (value: string) => {
    whereDraft = value;
    if (!value && where) applyWhere("");
  };

  const onWhereKey = (event: KeyboardEvent) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    applyWhere(whereDraft);
  };

  const summary = $derived(
    result
      ? joined(
          statementSummary(result.wrote && result.affected !== null ? null : (result.rows?.length ?? null), result.affected),
          formatDuration(result.elapsed),
        )
      : "",
  );
</script>

{#snippet toolbar()}
  {#if consoleView}
    <TooltipIconButton label={t("RUN")} shortcut={RUN_SHORTCUT} enabled={!!sql.trim() && !running} onclick={() => void execute()}>
      <Play />
    </TooltipIconButton>
    <TooltipIconButton label={t("DATABASE_EXPORT_CSV")} enabled={exportable && !exporting} onclick={() => void exportQuery()}>
      <Download />
    </TooltipIconButton>
    <TooltipIconButton label={t("CLEAR")} enabled={!!sql || !!result} onclick={clear}>
      <Eraser />
    </TooltipIconButton>
  {:else}
    <TooltipIconButton label={t("REFRESH")} enabled={!loading} onclick={reload}>
      <RotateCw />
    </TooltipIconButton>
    <TooltipIconButton label={t("DATABASE_STRUCTURE")} active={showInfo} enabled={!!info} onclick={() => (showInfo = !showInfo)}>
      <Info />
    </TooltipIconButton>
    <TooltipIconButton label={t("DATABASE_ADD_ROW")} enabled={!!info?.editable} onclick={() => (adding = true)}>
      <Plus />
    </TooltipIconButton>
    <PopupMenu open={exportMenu} onOpenChange={(value) => (exportMenu = value)} label={t("EXPORT")}>
      {#snippet triggerChild(props)}
        <TooltipIconButton label={t("EXPORT")} enabled={!!rows && !exporting} {...props}>
          <Download />
        </TooltipIconButton>
      {/snippet}
      {#each EXPORT_FORMATS as format (format)}
        <MenuItem text={t(EXPORT_LABELS[format])} onclick={() => void exportTable(format)} />
      {/each}
    </PopupMenu>
  {/if}
  {#if centered}
    <CenterViewToggle />
  {/if}
  {#if onExpand}
    <TooltipIconButton label={t("EXPAND")} onclick={onExpand}>
      <Maximize2 />
    </TooltipIconButton>
  {/if}
{/snippet}

{#snippet tableBody()}
  {#if showInfo && info}
    <TableInfoPanel {info} />
  {:else}
    {@render tableRows()}
  {/if}
{/snippet}

{#snippet tableRows()}
  <div class={BODY_CLASS}>
    <SearchBar
      icon={ListFilter}
      value={whereDraft}
      oninput={typeWhere}
      placeholder={t("DATABASE_WHERE_PLACEHOLDER")}
      onkeydown={onWhereKey}
      class="shrink-0"
    />
    <div class={CARD_CLASS}>
      {#if loading || exporting}
        <LinearProgress class="absolute inset-x-0 top-0 z-30" />
      {/if}
      {#if failure}
        <div class="flex flex-col items-start gap-2 p-3">
          <ErrorText text={failure} />
          <ActionButton text={t("RETRY")} onclick={reload} />
        </div>
      {:else if rows === null}
        <CenteredProgress class="min-h-0 flex-1" />
      {:else if !rows.rows.length}
        <EmptyState icon={Table2} text={t(where ? "NO_RESULTS" : "DATABASE_NO_ROWS")} class="min-h-0 flex-1" />
      {:else}
        <DataGrid
          columns={rows.columns}
          rows={rows.rows}
          offset={(rows.page - 1) * rows.size}
          {kinds}
          keys={info?.primaryKey ?? []}
          {sort}
          {descending}
          onSort={sortBy}
          onRow={info ? (index) => (editing = index) : null}
        />
      {/if}
    </div>
  </div>
  <div class={BAR_REGION_CLASS}>
    {#if rows}
      <div class={BAR_DOCK_CLASS}>
        <RowsPager
          page={rows.page}
          size={rows.size}
          total={rows.total}
          shown={rows.rows.length}
          sizes={listed?.pageSizes ?? []}
          onPage={goTo}
          onSize={resize}
        />
      </div>
    {/if}
  </div>
{/snippet}

{#snippet consoleBody()}
  <div class={BODY_CLASS}>
    <InputField
      value={sql}
      oninput={setSql}
      placeholder={t("DATABASE_SQL_PLACEHOLDER")}
      minLines={4}
      maxLines={12}
      mono
      autofocus
      onkeydown={onSqlKey}
      class="shrink-0"
    />
    <div class={CARD_CLASS}>
      {#if running || exporting}
        <LinearProgress class="absolute inset-x-0 top-0 z-30" />
      {/if}
      {#if failure}
        <ErrorText text={failure} class="p-3" />
      {:else if result?.rows && result.columns}
        <DataGrid columns={result.columns} rows={result.rows} kinds={kindsOfValues(result.columns, result.rows)} />
      {:else if result}
        <EmptyState icon={Check} text={summary} class="min-h-0 flex-1" />
      {:else}
        <EmptyState icon={Play} text={t("NO_RESULTS")} class="min-h-0 flex-1" />
      {/if}
    </div>
  </div>
  <div class={BAR_REGION_CLASS}>
    {#if result}
      <div class={BAR_DOCK_CLASS}>
        <GridBar label={joined(summary, result.truncated && t("DATABASE_TRUNCATED", formatDecimal(listed?.maxRows ?? 0, 0)))} />
      </div>
    {/if}
  </div>
{/snippet}

{#snippet content()}
  {#if consoleView}
    {@render consoleBody()}
  {:else}
    {@render tableBody()}
  {/if}
{/snippet}

{#if embedded}
  <div class="flex h-full min-h-0 flex-col bg-background text-on-surface">
    <PaneHeader {title} onBack={onClose} actions={toolbar} />
    {@render content()}
  </div>
{:else}
  <div class="safe-area above-keyboard fixed inset-0 z-50 flex flex-col bg-background text-on-surface {FULL_INSET_CLASS}">
    <AppTopBar title={entry?.name ?? t("DATABASES")} subtitle={title} actions={toolbar}>
      {#snippet navigationIcon()}
        <TooltipIconButton label={t("BACK")} onclick={onClose}>
          <ArrowLeft />
        </TooltipIconButton>
      {/snippet}
    </AppTopBar>
    {@render content()}
  </div>
{/if}

{#if info && rows && (editing !== null || adding)}
  <RowDialog
    {scope}
    {info}
    columns={rows.columns}
    row={editing === null ? null : (rows.rows[editing] ?? null)}
    {gate}
    onDone={() => void load()}
    onDismiss={() => {
      editing = null;
      adding = false;
    }}
  />
{/if}

{#if gate.asking}
  <SecurityKeyDialog rejected={gate.rejected} onConfirm={(key) => gate.confirm(key)} onDismiss={() => gate.dismiss()} />
{/if}
