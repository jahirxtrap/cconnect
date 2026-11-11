import { untrack } from "svelte";
import {
  databaseFailureText,
  type DatabaseConnection,
  type DatabaseEngine,
  type DatabaseFailure,
  type DatabaseList,
  type DatabaseObjects,
  type DatabaseSchemas,
  type DatabaseScope,
  type QueryResult,
  type RowsPage,
  type TableInfo,
} from "$lib/data/databaseModels";
import { keyRefused, type KeyGate } from "$lib/data/keyGate.svelte";
import { securityKeys } from "$lib/data/securityKeys.svelte";
import { backend, type Profile } from "./backend.svelte";
import { createDatabasesApi, type DatabaseOutcome } from "./databasesApi";

export interface Loaded<T> {
  value: T | null;
  failure: DatabaseFailure | null;
  loading: boolean;
}

export interface ConsoleDraft {
  sql: string;
  result: QueryResult | null;
  ran: string;
}

const EMPTY_DRAFT: ConsoleDraft = { sql: "", result: null, ran: "" };

export interface TableView {
  info: TableInfo | null;
  rows: RowsPage | null;
  page: number;
  size: number;
  sort: string | null;
  descending: boolean;
  where: string;
}

const EMPTY_TABLE_VIEW: TableView = { info: null, rows: null, page: 1, size: 0, sort: null, descending: false, where: "" };

const slotOf = (profile: Profile, ...parts: (string | null)[]) => [profile?.id ?? "", ...parts.map((part) => part ?? "")].join("|");

const scopeSlot = (profile: Profile, scope: DatabaseScope, ...parts: (string | null)[]) =>
  slotOf(profile, scope.connection, scope.database, ...parts);

class Databases {
  #lists = $state<Record<string, DatabaseList>>({});
  #failed = $state<Record<string, boolean>>({});
  #locked = $state<Record<string, boolean>>({});
  #files = $state<Record<string, DatabaseConnection>>({});
  #schemas = $state<Record<string, Loaded<DatabaseSchemas>>>({});
  #objects = $state<Record<string, Loaded<DatabaseObjects>>>({});
  #expanded = $state<Record<string, boolean>>({});
  #drafts = $state<Record<string, ConsoleDraft>>({});
  #tables = $state<Record<string, TableView>>({});

  listOf(profile: Profile): DatabaseList | null {
    return profile ? (this.#lists[profile.id] ?? null) : null;
  }

  failed(profile: Profile): boolean {
    return profile ? this.#failed[profile.id] === true : false;
  }

  locked(profile: Profile): boolean {
    return profile ? this.#locked[profile.id] === true : false;
  }

  find(profile: Profile, id: string | null): DatabaseConnection | null {
    if (!id) return null;
    return this.listOf(profile)?.connections.find((connection) => connection.id === id) ?? this.#files[slotOf(profile, id)] ?? null;
  }

  engine(profile: Profile, id: string): DatabaseEngine | null {
    return this.listOf(profile)?.engines.find((engine) => engine.id === id) ?? null;
  }

  async refresh(profile: Profile = backend.active, key = securityKeys.keyFor(profile)): Promise<boolean> {
    if (!profile) return false;
    untrack(() => (this.#failed = { ...this.#failed, [profile.id]: false }));
    const api = createDatabasesApi(() => profile);
    const [catalog, saved] = await Promise.all([api.catalog(), api.connections(key)]);
    const refused = keyRefused(saved);
    const answered = catalog.ok && (saved.ok || refused);
    if (answered) this.#lists = { ...this.#lists, [profile.id]: { ...catalog.value, connections: saved.value ?? [] } };
    this.#locked = { ...this.#locked, [profile.id]: refused };
    this.#failed = { ...this.#failed, [profile.id]: !answered };
    return !refused;
  }

  adoptEngines(profile: Profile, engines: DatabaseEngine[]) {
    const current = this.listOf(profile);
    if (profile && current) this.#lists = { ...this.#lists, [profile.id]: { ...current, engines } };
  }

  adoptFile(profile: Profile, connection: DatabaseConnection) {
    this.#files = { ...untrack(() => this.#files), [slotOf(profile, connection.id)]: connection };
  }

  async installDriver(profile: Profile, connection: DatabaseConnection, gate: KeyGate): Promise<string | null> {
    const api = createDatabasesApi(() => profile);
    const result = await gate.run((key) =>
      connection.url ? api.installPackages(connection.packages, key) : api.install(connection.engine, key),
    );
    if (result.ok) this.adoptEngines(profile, result.value);
    this.forget(profile, connection.id);
    return result.ok || keyRefused(result) ? null : databaseFailureText(result.failure);
  }

  schemasOf(profile: Profile, scope: DatabaseScope): Loaded<DatabaseSchemas> | null {
    return this.#schemas[scopeSlot(profile, scope)] ?? null;
  }

  objectsOf(profile: Profile, scope: DatabaseScope, schema: string | null): Loaded<DatabaseObjects> | null {
    return this.#objects[scopeSlot(profile, scope, schema)] ?? null;
  }

  async loadSchemas(profile: Profile, scope: DatabaseScope) {
    const api = createDatabasesApi(() => profile);
    await this.#load(this.#schemas, scopeSlot(profile, scope), () => api.schemas(scope), (next) => (this.#schemas = next));
  }

  async loadObjects(profile: Profile, scope: DatabaseScope, schema: string | null) {
    const api = createDatabasesApi(() => profile);
    await this.#load(
      this.#objects,
      scopeSlot(profile, scope, schema),
      () => api.objects(scope, schema),
      (next) => (this.#objects = next),
    );
  }

  async #load<T>(
    store: Record<string, Loaded<T>>,
    slot: string,
    fetch: () => Promise<DatabaseOutcome<T>>,
    save: (next: Record<string, Loaded<T>>) => void,
  ) {
    const previous = untrack(() => store[slot]?.value ?? null);
    save({ ...untrack(() => store), [slot]: { value: previous, failure: null, loading: true } });
    const result = await fetch();
    save({ ...untrack(() => store), [slot]: { value: result.value ?? null, failure: result.ok ? null : result.failure, loading: false } });
  }

  forget(profile: Profile, id: string) {
    const prefix = `${slotOf(profile, id)}|`;
    const kept = <T>(store: Record<string, T>) =>
      Object.fromEntries(Object.entries(store).filter(([slot]) => slot !== slotOf(profile, id) && !slot.startsWith(prefix)));
    this.#schemas = kept(this.#schemas);
    this.#objects = kept(this.#objects);
    this.#tables = kept(this.#tables);
  }

  expanded(profile: Profile, ...path: (string | null)[]): boolean {
    return this.#expanded[slotOf(profile, ...path)] === true;
  }

  setExpanded(profile: Profile, open: boolean, ...path: (string | null)[]) {
    this.#expanded = { ...this.#expanded, [slotOf(profile, ...path)]: open };
  }

  draftOf(profile: Profile, scope: DatabaseScope): ConsoleDraft {
    return this.#drafts[scopeSlot(profile, scope)] ?? EMPTY_DRAFT;
  }

  saveDraft(profile: Profile, scope: DatabaseScope, draft: Partial<ConsoleDraft>) {
    const slot = scopeSlot(profile, scope);
    this.#drafts = { ...this.#drafts, [slot]: { ...(this.#drafts[slot] ?? EMPTY_DRAFT), ...draft } };
  }

  tableViewOf(profile: Profile, scope: DatabaseScope, schema: string | null, name: string): TableView {
    return this.#tables[scopeSlot(profile, scope, schema, name)] ?? EMPTY_TABLE_VIEW;
  }

  saveTableView(profile: Profile, scope: DatabaseScope, schema: string | null, name: string, view: Partial<TableView>) {
    const slot = scopeSlot(profile, scope, schema, name);
    this.#tables = { ...this.#tables, [slot]: { ...(this.#tables[slot] ?? EMPTY_TABLE_VIEW), ...view } };
  }
}

export const databases = new Databases();
