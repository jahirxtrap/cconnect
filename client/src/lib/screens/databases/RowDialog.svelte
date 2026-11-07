<script lang="ts">
  import Ban from "@lucide/svelte/icons/ban";
  import CopyPlus from "@lucide/svelte/icons/copy-plus";
  import Trash2 from "@lucide/svelte/icons/trash-2";
  import { untrack } from "svelte";
  import {
    databaseFailureText,
    rowKey,
    rowValues,
    type CellValue,
    type ColumnKind,
    type DatabaseFailure,
    type DatabaseScope,
    type RowValues,
    type TableColumn,
    type TableInfo,
  } from "$lib/data/databaseModels";
  import { joined } from "$lib/data/format";
  import { keyRefused, type KeyGate } from "$lib/data/keyGate.svelte";
  import { t } from "$lib/i18n/index.svelte";
  import { backend } from "$lib/services/backend.svelte";
  import { createDatabasesApi } from "$lib/services/databasesApi";
  import Button from "$lib/ui/Button.svelte";
  import CompactDialog from "$lib/ui/CompactDialog.svelte";
  import ConfirmDialog from "$lib/ui/ConfirmDialog.svelte";
  import ErrorText from "$lib/ui/ErrorText.svelte";
  import InputField from "$lib/ui/InputField.svelte";
  import SelectField from "$lib/ui/SelectField.svelte";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";

  interface Props {
    scope: DatabaseScope;
    info: TableInfo;
    columns: string[];
    row: CellValue[] | null;
    gate: KeyGate;
    onDone: () => void;
    onDismiss: () => void;
  }

  const { scope, info, columns, row, gate, onDone, onDismiss }: Props = $props();

  const LONG: ColumnKind[] = ["json", "text"];
  const NUMERIC: ColumnKind[] = ["integer", "number"];
  const CHOICES: ColumnKind[] = ["boolean", "enum"];
  const BOOLEANS = ["true", "false"];
  const NULL_CHOICE = String.fromCharCode(0);
  const NULL_TEXT = "NULL";
  const PLACEHOLDERS: Partial<Record<ColumnKind, string>> = {
    date: "YYYY-MM-DD",
    datetime: "YYYY-MM-DD HH:MM:SS",
    time: "HH:MM:SS",
  };

  const api = createDatabasesApi(() => backend.active);
  const source = untrack(() => (row ? rowValues(columns, row) : null));

  const fieldText = (value: CellValue | undefined, kind: ColumnKind): string | null => {
    if (value === null || value === undefined) return null;
    if (typeof value === "object") return JSON.stringify(value, null, kind === "json" ? 2 : 0);
    return String(value);
  };

  const initial = (column: TableColumn, copying: boolean): string | null => {
    if (!source || (copying && column.auto)) return "";
    return fieldText(source[column.name], column.kind);
  };

  let copying = $state(false);
  let values = $state<Record<string, string | null>>(
    Object.fromEntries(untrack(() => info.columns.map((column) => [column.name, initial(column, false)]))),
  );
  let failed = $state<string | null>(null);
  let saving = $state(false);
  let deleting = $state(false);

  const editing = $derived(source !== null && !copying);
  const writable = $derived(info.editable);
  const required = (column: TableColumn) => !editing && !column.nullable && column.default === null && !column.auto;
  const locked = (column: TableColumn) => !writable || column.kind === "binary" || (editing && column.auto);
  const valid = $derived(info.columns.every((column) => !required(column) || !!values[column.name]));
  const title = $derived(!writable ? t("DATABASE_ROW") : editing ? t("DATABASE_EDIT_ROW") : t("DATABASE_ADD_ROW"));

  const placeholder = (column: TableColumn) => {
    if (values[column.name] === null) return NULL_TEXT;
    if (editing) return undefined;
    if (column.auto) return t("DATABASE_AUTO");
    return column.default ?? PLACEHOLDERS[column.kind];
  };

  const optionsOf = (column: TableColumn) => [
    ...(column.kind === "boolean" ? BOOLEANS : column.options).map((value) => ({ value, label: value })),
    ...(column.nullable ? [{ value: NULL_CHOICE, label: NULL_TEXT }] : []),
  ];

  const changes = (): RowValues => {
    const sent: RowValues = {};
    for (const column of info.columns) {
      if (locked(column)) continue;
      const value = values[column.name];
      const before = editing ? initial(column, false) : "";
      if (value === before) continue;
      sent[column.name] = value;
    }
    return sent;
  };

  const touched = $derived(!editing || Object.keys(changes()).length > 0);

  const report = (failure: DatabaseFailure | null) => {
    failed = databaseFailureText(failure);
  };

  const finish = async (attempt: (key: string) => Promise<{ ok: boolean; status: number; failure: DatabaseFailure | null }>) => {
    saving = true;
    failed = null;
    const result = await gate.run(attempt);
    saving = false;
    if (!result.ok) {
      if (!keyRefused(result)) report(result.failure);
      return;
    }
    onDone();
    onDismiss();
  };

  const save = () => {
    const sent = changes();
    if (!editing) return finish((key) => api.insertRow(scope, info.schema, info.name, sent, key));
    const target = rowKey(info, columns, row ?? []);
    return finish((key) => api.updateRow(scope, info.schema, info.name, target, sent, key));
  };

  const remove = () => {
    deleting = false;
    const target = rowKey(info, columns, row ?? []);
    return finish((key) => api.deleteRow(scope, info.schema, info.name, target, key));
  };

  const duplicate = () => {
    copying = true;
    failed = null;
    values = Object.fromEntries(info.columns.map((column) => [column.name, initial(column, true)]));
  };
</script>

{#snippet rowActions()}
  {#if editing && writable}
    <TooltipIconButton label={t("DUPLICATE")} onclick={duplicate}>
      <CopyPlus />
    </TooltipIconButton>
    <TooltipIconButton label={t("DELETE")} onclick={() => (deleting = true)}>
      <Trash2 />
    </TooltipIconButton>
  {/if}
{/snippet}

<CompactDialog {title} subtitle={info.name} titleTrailing={rowActions} {onDismiss}>
  {#snippet buttons()}
    {#if writable}
      <Button onclick={onDismiss} variant="outlined">{t("CANCEL")}</Button>
      <Button onclick={() => void save()} enabled={valid && touched && !saving}>{t("SAVE")}</Button>
    {:else}
      <Button onclick={onDismiss} variant="outlined">{t("CLOSE")}</Button>
    {/if}
  {/snippet}

  <div class="flex w-full flex-col gap-2">
    {#each info.columns as column (column.name)}
      {@const value = values[column.name]}
      {@const label = joined(column.name, column.type)}
      {@const nullable = column.nullable && !locked(column)}
      {#snippet nullToggle()}
        <TooltipIconButton
          label={NULL_TEXT}
          active={value === null}
          onclick={() => (values[column.name] = value === null ? "" : null)}
        >
          <Ban />
        </TooltipIconButton>
      {/snippet}
      {#if CHOICES.includes(column.kind) && !locked(column)}
        <SelectField
          {label}
          selected={value ?? NULL_CHOICE}
          shown={value === "" ? (placeholder(column) ?? "") : null}
          options={optionsOf(column)}
          onSelect={(picked) => (values[column.name] = picked === NULL_CHOICE ? null : picked)}
        />
      {:else}
        <InputField
          value={value ?? ""}
          oninput={(text) => (values[column.name] = text)}
          {label}
          required={required(column)}
          placeholder={placeholder(column)}
          readonly={locked(column) || value === null}
          singleLine={!LONG.includes(column.kind)}
          minLines={column.kind === "json" ? 3 : 2}
          numeric={NUMERIC.includes(column.kind)}
          mono={column.kind === "json"}
          trailing={nullable ? nullToggle : undefined}
        />
      {/if}
    {/each}
    {#if failed}
      <ErrorText text={failed} />
    {/if}
  </div>
</CompactDialog>

{#if deleting}
  <ConfirmDialog
    title={t("DELETE")}
    text={t("DATABASE_DELETE_ROW_CONFIRM", info.name)}
    confirmLabel={t("DELETE")}
    danger
    onConfirm={() => void remove()}
    onDismiss={() => (deleting = false)}
  />
{/if}
