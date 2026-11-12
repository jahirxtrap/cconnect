import {
  toDatabaseConnection,
  toDatabaseEngine,
  toDatabaseFailure,
  toDatabaseList,
  toDatabaseObjects,
  toDatabaseSchemas,
  toQueryResult,
  toRowsPage,
  toTableInfo,
  type DatabaseFailure,
  type DatabaseFileSource,
  type DatabaseScope,
  type ExportFormat,
  type RowValues,
  type SshTunnel,
  type TableQuery,
} from "$lib/data/databaseModels";
import { judgeKey } from "$lib/data/keyGate.svelte";
import { securityKeys } from "$lib/data/securityKeys.svelte";
import { list } from "$lib/data/wire";
import type { Profile } from "./backend.svelte";
import { createHttp, outcomeOf, type HttpResult, type Outcome } from "./http";

type Wire = Record<string, unknown>;

export interface ConnectionFields {
  name?: string;
  engine?: string;
  host?: string;
  port?: number | null;
  database?: string;
  user?: string;
  password?: string;
  path?: string;
  url?: string;
  packages?: string[];
  options?: Record<string, string>;
  read_only?: boolean;
  ssh?: SshTunnel | null;
}

export type DatabaseOutcome<T> = Outcome<T, DatabaseFailure>;

const outcome = <T>(result: HttpResult<Wire>, parse: (data: Wire) => T): DatabaseOutcome<T> =>
  outcomeOf(result, parse, toDatabaseFailure);

const segment = (id: string) => encodeURIComponent(id);

const pathOf = (data: Wire) => (typeof data.path === "string" ? data.path : "");

const enginesOf = (data: Wire) => list(data, "engines").map(toDatabaseEngine);

export const createDatabasesApi = (profile: () => Profile) => {
  const client = createHttp(profile, () => securityKeys.headersFor(profile()));
  const keyed = (key: string) => createHttp(profile, () => securityKeys.headers(key));
  const base = (id: string) => `/databases/${segment(id)}`;
  const database = (scope: DatabaseScope) => scope.database ?? undefined;

  return {
    async catalog() {
      return outcome(await client.call<Wire>("GET", "/databases/engines"), toDatabaseList);
    },

    async connections(key: string) {
      const target = profile();
      const result = await keyed(key).call<Wire>("GET", "/databases");
      judgeKey(target, key, result);
      return outcome(result, (data) => list(data, "connections").map(toDatabaseConnection));
    },

    async add(fields: ConnectionFields, key: string) {
      return outcome(await keyed(key).call<Wire>("POST", "/databases", undefined, fields), toDatabaseConnection);
    },

    async update(id: string, fields: ConnectionFields, key: string) {
      return outcome(await keyed(key).call<Wire>("PATCH", base(id), undefined, fields), toDatabaseConnection);
    },

    async remove(id: string, key: string) {
      return outcome(await keyed(key).call<Wire>("DELETE", base(id)), () => true);
    },

    async test(fields: ConnectionFields, id: string | null, key: string) {
      return outcome(await keyed(key).call<Wire>("POST", "/databases/test", undefined, { ...fields, id }), (data) =>
        typeof data.server === "string" ? data.server : null,
      );
    },

    async install(engine: string, key: string) {
      return outcome(await keyed(key).call<Wire>("POST", `/databases/engines/${segment(engine)}/install`, undefined, {}), enginesOf);
    },

    async installPackages(packages: string[], key: string) {
      return outcome(await keyed(key).call<Wire>("POST", "/databases/packages", undefined, { packages }), enginesOf);
    },

    async uninstall(engine: string, key: string) {
      return outcome(await keyed(key).call<Wire>("DELETE", `/databases/engines/${segment(engine)}`), enginesOf);
    },

    async openFile(source: DatabaseFileSource, key: string) {
      return outcome(await keyed(key).call<Wire>("POST", "/databases/files", undefined, source), toDatabaseConnection);
    },

    async schemas(scope: DatabaseScope) {
      return outcome(
        await client.call<Wire>("GET", `${base(scope.connection)}/schemas`, { database: database(scope) }),
        toDatabaseSchemas,
      );
    },

    async objects(scope: DatabaseScope, schema: string | null) {
      return outcome(
        await client.call<Wire>("GET", `${base(scope.connection)}/objects`, { database: database(scope), schema: schema ?? undefined }),
        toDatabaseObjects,
      );
    },

    async table(scope: DatabaseScope, schema: string | null, name: string) {
      return outcome(
        await client.call<Wire>("GET", `${base(scope.connection)}/table`, { database: database(scope), schema: schema ?? undefined, name }),
        toTableInfo,
      );
    },

    async browse(scope: DatabaseScope, table: TableQuery, page: number, size: number) {
      return outcome(
        await client.call<Wire>("POST", `${base(scope.connection)}/browse`, undefined, { ...table, database: scope.database, page, size }),
        toRowsPage,
      );
    },

    async query(scope: DatabaseScope, sql: string, key: string) {
      return outcome(
        await keyed(key).call<Wire>("POST", `${base(scope.connection)}/query`, undefined, { database: scope.database, sql }),
        toQueryResult,
      );
    },

    async insertRow(scope: DatabaseScope, schema: string | null, name: string, values: RowValues, key: string) {
      return outcome(
        await keyed(key).call<Wire>("POST", `${base(scope.connection)}/rows`, undefined, { database: scope.database, schema, name, values }),
        () => true,
      );
    },

    async updateRow(scope: DatabaseScope, schema: string | null, name: string, rowKey: RowValues, values: RowValues, key: string) {
      return outcome(
        await keyed(key).call<Wire>("PATCH", `${base(scope.connection)}/rows`, undefined, {
          database: scope.database,
          schema,
          name,
          key: rowKey,
          values,
        }),
        () => true,
      );
    },

    async deleteRow(scope: DatabaseScope, schema: string | null, name: string, rowKey: RowValues, key: string) {
      return outcome(
        await keyed(key).call<Wire>("POST", `${base(scope.connection)}/rows/delete`, undefined, {
          database: scope.database,
          schema,
          name,
          key: rowKey,
        }),
        () => true,
      );
    },

    async exportTable(scope: DatabaseScope, table: TableQuery, format: ExportFormat) {
      return outcome(
        await client.call<Wire>("POST", `${base(scope.connection)}/export`, undefined, { ...table, database: scope.database, format }),
        pathOf,
      );
    },

    async exportQuery(scope: DatabaseScope, sql: string) {
      return outcome(
        await client.call<Wire>("POST", `${base(scope.connection)}/export/query`, undefined, { database: scope.database, sql }),
        pathOf,
      );
    },

    async exportDump(scope: DatabaseScope, schema: string | null) {
      return outcome(
        await client.call<Wire>("POST", `${base(scope.connection)}/export/dump`, undefined, { database: scope.database, schema }),
        pathOf,
      );
    },
  };
};

export type DatabasesApi = ReturnType<typeof createDatabasesApi>;
