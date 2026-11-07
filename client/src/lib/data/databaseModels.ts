import { t } from "$lib/i18n/index.svelte";
import { flag, list, number, record, strings, text, type Wire } from "./wire";

export type CellValue = string | number | boolean | null | CellValue[] | { [key: string]: CellValue };

export type ColumnKind =
  | "boolean"
  | "enum"
  | "integer"
  | "number"
  | "json"
  | "datetime"
  | "date"
  | "time"
  | "binary"
  | "text"
  | "string";

export type EngineForm = "file" | "server" | "url";

export interface DatabaseEngine {
  id: string;
  label: string | null;
  form: EngineForm;
  host: boolean;
  port: number | null;
  packages: string[];
  options: string[];
  installed: boolean;
}

export interface SshTunnel {
  host: string;
  port: number | null;
  user: string;
  key: string;
}

export interface DatabaseConnection {
  id: string;
  name: string;
  engine: string;
  host: string;
  port: number | null;
  database: string;
  user: string;
  path: string;
  url: string;
  packages: string[];
  options: Record<string, string>;
  readOnly: boolean;
  ssh: SshTunnel | null;
  hasPassword: boolean;
}

export interface DatabaseList {
  connections: DatabaseConnection[];
  engines: DatabaseEngine[];
  pageSizes: number[];
  pageSize: number;
  maxRows: number;
}

export interface DatabaseFailure {
  reason: string;
  detail: string;
}

export interface DatabaseScope {
  connection: string;
  database: string | null;
}

export interface DatabaseFileSource {
  project: string | null;
  path: string;
}

export interface DatabaseSchemas {
  databases: string[] | null;
  schemas: string[];
  default: string | null;
}

export interface DatabaseObjects {
  tables: string[];
  views: string[];
}

export interface TableColumn {
  name: string;
  type: string;
  kind: ColumnKind;
  nullable: boolean;
  default: string | null;
  auto: boolean;
  primaryKey: boolean;
  comment: string | null;
  options: string[];
}

export interface ForeignKey {
  columns: string[];
  schema: string | null;
  table: string;
  referred: string[];
}

export interface TableIndex {
  name: string | null;
  columns: string[];
  unique: boolean;
}

export interface TableInfo {
  schema: string | null;
  name: string;
  kind: "table" | "view";
  comment: string | null;
  definition: string | null;
  editable: boolean;
  primaryKey: string[];
  columns: TableColumn[];
  foreignKeys: ForeignKey[];
  indexes: TableIndex[];
}

export interface RowsPage {
  columns: string[];
  rows: CellValue[][];
  total: number;
  page: number;
  size: number;
}

export interface QueryResult {
  columns: string[] | null;
  rows: CellValue[][] | null;
  truncated: boolean;
  affected: number | null;
  statements: number;
  wrote: boolean;
  elapsed: number;
}

export interface TableQuery {
  schema: string | null;
  name: string;
  sort: string | null;
  descending: boolean;
  where: string;
}

export type RowValues = Record<string, CellValue>;

export const EXPORT_FORMATS = ["csv", "sql"] as const;

export type ExportFormat = (typeof EXPORT_FORMATS)[number];

const tunnelOf = (raw: Wire): SshTunnel | null => {
  const host = text(raw, "host");
  return host ? { host, port: number(raw, "port"), user: text(raw, "user") ?? "", key: text(raw, "key") ?? "" } : null;
};

const FORMS: EngineForm[] = ["file", "server", "url"];

export const toDatabaseEngine = (raw: Wire): DatabaseEngine => ({
  id: text(raw, "id") ?? "",
  label: text(raw, "label"),
  form: FORMS.find((form) => form === raw.form) ?? "server",
  host: flag(raw, "host"),
  port: number(raw, "port"),
  packages: strings(raw, "packages"),
  options: strings(raw, "options"),
  installed: flag(raw, "installed"),
});

export const engineLabel = (engine: DatabaseEngine | null, fallback: string) =>
  engine?.label ?? (engine?.form === "url" ? t("DATABASE_CUSTOM_ENGINE") : fallback);

export const toDatabaseConnection = (raw: Wire): DatabaseConnection => ({
  id: text(raw, "id") ?? "",
  name: text(raw, "name") ?? "",
  engine: text(raw, "engine") ?? "",
  host: text(raw, "host") ?? "",
  port: number(raw, "port"),
  database: text(raw, "database") ?? "",
  user: text(raw, "user") ?? "",
  path: text(raw, "path") ?? "",
  url: text(raw, "url") ?? "",
  packages: strings(raw, "packages"),
  options: Object.fromEntries(Object.entries(record(raw, "options")).map(([key, value]) => [key, String(value)])),
  readOnly: flag(raw, "read_only"),
  ssh: tunnelOf(record(raw, "ssh")),
  hasPassword: flag(raw, "has_password"),
});

export const toDatabaseList = (raw: Wire): DatabaseList => ({
  connections: list(raw, "connections").map(toDatabaseConnection),
  engines: list(raw, "engines").map(toDatabaseEngine),
  pageSizes: Array.isArray(raw.page_sizes) ? raw.page_sizes.filter((size): size is number => typeof size === "number") : [],
  pageSize: number(raw, "page_size") ?? 0,
  maxRows: number(raw, "max_rows") ?? 0,
});

export const toDatabaseFailure = (raw: unknown): DatabaseFailure | null => {
  if (!raw || typeof raw !== "object") return null;
  const reason = text(raw as Wire, "reason");
  return reason ? { reason, detail: text(raw as Wire, "detail") ?? "" } : null;
};

export const toDatabaseSchemas = (raw: Wire): DatabaseSchemas => ({
  databases: Array.isArray(raw.databases) ? strings(raw, "databases") : null,
  schemas: strings(raw, "schemas"),
  default: text(raw, "default"),
});

export const toDatabaseObjects = (raw: Wire): DatabaseObjects => ({
  tables: strings(raw, "tables"),
  views: strings(raw, "views"),
});

const toColumn = (raw: Wire): TableColumn => ({
  name: text(raw, "name") ?? "",
  type: text(raw, "type") ?? "",
  kind: (text(raw, "kind") ?? "string") as ColumnKind,
  nullable: flag(raw, "nullable"),
  default: text(raw, "default"),
  auto: flag(raw, "auto"),
  primaryKey: flag(raw, "primary_key"),
  comment: text(raw, "comment"),
  options: strings(raw, "options"),
});

export const toTableInfo = (raw: Wire): TableInfo => ({
  schema: text(raw, "schema"),
  name: text(raw, "name") ?? "",
  kind: text(raw, "kind") === "view" ? "view" : "table",
  comment: text(raw, "comment"),
  definition: text(raw, "definition"),
  editable: flag(raw, "editable"),
  primaryKey: strings(raw, "primary_key"),
  columns: list(raw, "columns").map(toColumn),
  foreignKeys: list(raw, "foreign_keys").map((key) => ({
    columns: strings(key, "columns"),
    schema: text(key, "schema"),
    table: text(key, "table") ?? "",
    referred: strings(key, "referred"),
  })),
  indexes: list(raw, "indexes").map((index) => ({
    name: text(index, "name"),
    columns: strings(index, "columns"),
    unique: flag(index, "unique"),
  })),
});

const rowsOf = (raw: Wire): CellValue[][] | null =>
  Array.isArray(raw.rows) ? raw.rows.filter((row): row is CellValue[] => Array.isArray(row)) : null;

export const toRowsPage = (raw: Wire): RowsPage => ({
  columns: strings(raw, "columns"),
  rows: rowsOf(raw) ?? [],
  total: number(raw, "total") ?? 0,
  page: number(raw, "page") ?? 1,
  size: number(raw, "size") ?? 0,
});

export const toQueryResult = (raw: Wire): QueryResult => ({
  columns: Array.isArray(raw.columns) ? strings(raw, "columns") : null,
  rows: rowsOf(raw),
  truncated: flag(raw, "truncated"),
  affected: number(raw, "affected"),
  statements: number(raw, "statements") ?? 0,
  wrote: flag(raw, "wrote"),
  elapsed: number(raw, "elapsed") ?? 0,
});

const WITHOUT_DETAIL = new Set(["missing", "timeout", "rows"]);

const REASON_KEYS: Record<string, string> = {
  missing: "DATABASE_REASON_MISSING",
  invalid: "DATABASE_REASON_INVALID",
  driver: "DATABASE_REASON_DRIVER",
  connect: "DATABASE_REASON_CONNECT",
  query: "DATABASE_REASON_QUERY",
  timeout: "DATABASE_REASON_TIMEOUT",
  read_only: "DATABASE_REASON_READ_ONLY",
  not_editable: "DATABASE_REASON_NOT_EDITABLE",
  rows: "DATABASE_REASON_ROWS",
  install: "DATABASE_REASON_INSTALL",
  engine: "DATABASE_REASON_ENGINE",
  ssh_missing: "DATABASE_REASON_SSH_MISSING",
  tunnel: "DATABASE_REASON_TUNNEL",
};

export const databaseFailureText = (failure: DatabaseFailure | null): string => {
  if (!failure) return t("CONNECTION_ERROR");
  const key = REASON_KEYS[failure.reason];
  const reason = key ? t(key, failure.detail) : null;
  return [reason, WITHOUT_DETAIL.has(failure.reason) ? "" : failure.detail].filter(Boolean).join("\n");
};

export const cellText = (value: CellValue): string =>
  value === null ? "" : typeof value === "object" ? JSON.stringify(value) : String(value);

export const connectionTarget = (connection: DatabaseConnection, engine: DatabaseEngine | null): string => {
  if (connection.path || connection.url) return connection.path || connection.url;
  const port = connection.port ?? engine?.port;
  const place = port ? `${connection.host}:${port}` : connection.host;
  return connection.database ? `${place}/${connection.database}` : place;
};

export const qualifiedName = (...parts: (string | null)[]) => parts.filter(Boolean).join(".");

export const rowKey = (info: TableInfo, columns: string[], row: CellValue[]): RowValues =>
  Object.fromEntries(info.primaryKey.map((name) => [name, row[columns.indexOf(name)] ?? null]));

export const rowValues = (columns: string[], row: CellValue[]): RowValues =>
  Object.fromEntries(columns.map((name, index) => [name, row[index] ?? null]));
