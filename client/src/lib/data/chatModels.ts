import type { ColumnShape } from "./databaseModels";
import type { ModDrawn } from "./modModels";
import type { Usage } from "./usageWindows";
import { flag, list, number, record, strings, text, type Wire } from "./wire";

export type Role =
  | "user"
  | "assistant"
  | "thinking"
  | "working"
  | "tool"
  | "tool_result"
  | "summary"
  | "interaction"
  | "file_change"
  | "shared"
  | "compact"
  | "system"
  | "api_error"
  | "info"
  | "interrupted"
  | "plan"
  | "agent"
  | "notification"
  | "notice"
  | "session_message"
  | "plugin_message"
  | "agent_report"
  | "usage";

export type SendStatus = "sent" | "error";

export type ConnectionState = "connecting" | "connected" | "disconnected";

export type DiffKind = "header" | "hunk" | "add" | "del" | "ctx";

export interface DiffLine {
  kind: DiffKind;
  text: string;
}

export interface SharedFile {
  name: string;
  url: string;
}

export interface QueryCall {
  connection: string;
  name: string;
  database: string | null;
  sql: string;
  writes: boolean;
  saved: boolean;
}

export type StatementKind = "rows" | "changed" | "structure" | "done";

export interface StatementEffect {
  action: string;
  object: string;
  schema: string | null;
  name: string;
}

export interface QueryStatement {
  kind: StatementKind;
  columns: string[] | null;
  rows: (string | null)[][] | null;
  affected: number | null;
  more: boolean;
  structure: ColumnShape[] | null;
  effect: StatementEffect | null;
}

export interface GalleryFile extends SharedFile {
  poster?: string | null;
}

export interface CompactData {
  trigger: string | null;
  preTokens: number | null;
  postTokens: number | null;
  summary: string;
}

export interface AgentResult {
  status: string | null;
  durationMs: number | null;
  tokens: number | null;
  toolUses: number | null;
}

export interface AgentRun {
  model: string | null;
  effort: string | null;
  agent: string | null;
  account: { provider: boolean } | null;
}

export interface InteractionOption {
  id: string;
  label: string | null;
  description: string | null;
  preview: string | null;
}


export const VALUE_SEPARATOR = "\u001F";

export interface ComponentConfirm {
  title: string | null;
  text: string;
  confirmLabel: string | null;
}

export interface ComponentCondition {
  id: string;
  equals: string | null;
  oneOf: string[] | null;
  truthy: boolean | null;
}

export interface ComponentOption {
  value: string;
  label: string;
  description: string | null;
  preview: string | null;
  style: string | null;
  icon: string | null;
  labelKey: string | null;
  confirm: ComponentConfirm | null;
}

export type ComponentType =
  | "text"
  | "select"
  | "input"
  | "toggle"
  | "buttons"
  | "preview"
  | "page"
  | "group"
  | "notes"
  | "bar"
  | "slider"
  | "color"
  | "path"
  | "file";

export interface ComponentElement {
  type: ComponentType;
  id: string | null;
  label: string | null;
  text: string | null;
  textKey: string | null;
  placeholder: string | null;
  placeholderKey: string | null;
  value: string | null;
  checked: boolean;
  multiline: boolean;
  lines: number | null;
  secret: boolean;
  multiple: boolean;
  required: boolean;
  color: string | null;
  alertAbove: number | null;
  alertBelow: number | null;
  severity: string | null;
  showIf: ComponentCondition | null;
  format: string | null;
  display: string | null;
  min: number | null;
  max: number | null;
  step: number | null;
  minLength: number | null;
  maxLength: number | null;
  pattern: string | null;
  error: string | null;
  open: boolean;
  pick: string | null;
  start: string | null;
  accept: string | null;
  options: ComponentOption[];
  block: string | null;
  blocks: ComponentElement[];
}

export interface InteractionRequest {
  requestId: string;
  kind: string;
  options: InteractionOption[];
  title: string | null;
  titleKey: string | null;
  icon: string | null;
  blocks: ComponentElement[];
  submitLabel: string | null;
  submitKey: string | null;
  dismiss: ComponentOption | null;
  present: string | null;
  variant: string | null;
  mod: InteractionMod | null;
}

export interface InteractionData extends InteractionRequest {
  resolved: string | null;
  submitted: boolean;
  declined: boolean;
  activePage: number;
  dismissedBy: string | null;
  values: Record<string, string>;
}

export interface InteractionMod {
  instanceId: string;
  props: Record<string, unknown>;
  drawn: ModDrawn;
}

export interface ChatMessage {
  id: number;
  role: Role;
  text: string;
  toolName: string | null;
  toolMcp: boolean;
  toolUseId: string | null;
  interaction: InteractionData | null;
  path: string | null;
  diffLines: DiffLine[] | null;
  files: SharedFile[] | null;
  query: QueryCall | null;
  statements: QueryStatement[] | null;
  compact: CompactData | null;
  agentRun: AgentRun | null;
  agentResult: AgentResult | null;
  thinkingTokens: number | null;
  toolMs: number | null;
  sourceIndex: number;
  labelOnly: boolean;
  result: string | null;
  ephemeral: boolean;
  attachments: string[] | null;
  images: string[] | null;
  timestamp: number | null;
  children: ChatMessage[];
  sendStatus: SendStatus;
  usage: Usage | null;
  uuid: string | null;
}

export interface TodoItem {
  id: string | null;
  content: string;
  status: string;
  activeForm: string;
}

export interface BackgroundTask {
  id: string;
  description: string | null;
}

export interface QueuedMessage {
  id: string;
  text: string;
  attachments: string[];
  uploading: boolean;
}

export const sharedFilesFrom = (value: unknown): SharedFile[] =>
  (Array.isArray(value) ? value : [])
    .map((item) => (item && typeof item === "object" ? (item as Record<string, unknown>) : {}))
    .map((item) => ({ name: String(item.name ?? ""), url: String(item.url ?? "") }))
    .filter((file) => file.name !== "" && file.url !== "");

export const queryOf = (raw: Wire): QueryCall | null => {
  const call = record(raw, "query");
  const sql = text(call, "sql");
  return sql === null
    ? null
    : {
        connection: text(call, "connection") ?? "",
        name: text(call, "name") ?? "",
        database: text(call, "database"),
        sql,
        writes: flag(call, "writes"),
        saved: flag(call, "saved"),
      };
};

const cellsOf = (row: unknown): (string | null)[] =>
  Array.isArray(row) ? row.map((cell) => (typeof cell === "string" ? cell : null)) : [];

const STATEMENT_KINDS: StatementKind[] = ["rows", "changed", "structure", "done"];

const statementColumnOf = (raw: Wire): ColumnShape => ({
  name: text(raw, "name") ?? "",
  type: text(raw, "type") ?? "",
  primaryKey: flag(raw, "primary_key"),
  nullable: flag(raw, "nullable"),
  auto: flag(raw, "auto"),
  default: text(raw, "default"),
});

const effectOf = (raw: Wire): StatementEffect | null => {
  const action = text(raw, "action");
  return action ? { action, object: text(raw, "object") ?? "", schema: text(raw, "schema"), name: text(raw, "name") ?? "" } : null;
};

export const statementsOf = (raw: Wire): QueryStatement[] | null =>
  Array.isArray(raw.statements)
    ? list(raw, "statements").map((item) => ({
        kind: STATEMENT_KINDS.find((kind) => kind === item.kind) ?? "done",
        columns: Array.isArray(item.columns) ? strings(item, "columns") : null,
        rows: Array.isArray(item.rows) ? item.rows.map(cellsOf) : null,
        affected: number(item, "affected"),
        more: flag(item, "more"),
        structure: Array.isArray(item.structure) ? list(item, "structure").map(statementColumnOf) : null,
        effect: effectOf(record(item, "effect")),
      }))
    : null;

export const diffKindOf = (value: string | null | undefined): DiffKind =>
  value === "header" || value === "hunk" || value === "add" || value === "del" ? value : "ctx";

const NESTED = new Set<ComponentType>(["page", "group"]);

export const componentLeaves = (blocks: ComponentElement[]): ComponentElement[] =>
  blocks.flatMap((element) => (NESTED.has(element.type) ? componentLeaves(element.blocks) : [element]));

export const componentAnswerable = (blocks: ComponentElement[]): boolean =>
  blocks.some((element) =>
    NESTED.has(element.type) ? componentAnswerable(element.blocks) : element.type === "buttons" || !!element.id,
  );

const answered = (raw: string): boolean => raw !== "" && raw !== "false";

export const componentHidden = (element: ComponentElement, values: Record<string, string>): boolean => {
  const rule = element.showIf;
  if (!rule) return false;
  const raw = values[rule.id] ?? "";
  const parts = raw.split(VALUE_SEPARATOR).filter(Boolean);
  if (rule.equals !== null) return !parts.includes(rule.equals);
  if (rule.oneOf !== null) return !parts.some((part) => rule.oneOf!.includes(part));
  if (rule.truthy !== null) return rule.truthy ? !answered(raw) : answered(raw);
  return false;
};

const matches = (pattern: string, value: string): boolean => {
  try {
    return new RegExp(pattern).test(value);
  } catch {
    return true;
  }
};

export const componentInvalid = (element: ComponentElement, values: Record<string, string>): boolean => {
  if (element.type === "buttons" || element.type === "notes" || !element.id) return false;
  const raw = values[element.id] ?? "";
  if (!raw) return element.required;
  if (element.format === "number") {
    const value = Number(raw);
    if (Number.isNaN(value)) return true;
    if (element.min !== null && value < element.min) return true;
    if (element.max !== null && value > element.max) return true;
    return false;
  }
  if (element.type !== "input") return false;
  if (element.minLength !== null && raw.length < element.minLength) return true;
  if (element.maxLength !== null && raw.length > element.maxLength) return true;
  return element.pattern !== null && !matches(element.pattern, raw);
};

export const componentHiddenIds = (
  blocks: ComponentElement[],
  values: Record<string, string>,
  inherited = false,
): Set<string> => {
  const out = new Set<string>();
  for (const element of blocks) {
    const hidden = inherited || componentHidden(element, values);
    if (element.blocks.length) {
      for (const id of componentHiddenIds(element.blocks, values, hidden)) out.add(id);
    } else if (hidden && element.id) {
      out.add(element.id);
    }
  }
  return out;
};

export const componentValues = (
  blocks: ComponentElement[],
  values: Record<string, string>,
): Record<string, string> => {
  const hidden = componentHiddenIds(blocks, values);
  return Object.fromEntries(
    Object.entries(values).filter(([key, value]) => value !== "" && !hidden.has(key)),
  );
};

export const componentBlocked = (blocks: ComponentElement[], values: Record<string, string>): boolean =>
  blocks.some((element) => {
    if (componentHidden(element, values)) return false;
    if (element.type === "page") {
      const fields = componentLeaves(element.blocks).filter(
        (item) => item.type !== "notes" && !componentHidden(item, values),
      );
      if (element.required && !fields.some((item) => values[item.id ?? ""])) return true;
      return componentBlocked(element.blocks, values);
    }
    if (element.type === "group") return componentBlocked(element.blocks, values);
    return componentInvalid(element, values);
  });

export const isPending = (data: InteractionData): boolean =>
  data.kind === "component"
    ? componentAnswerable(data.blocks) && !(data.submitted || data.declined)
    : data.resolved === null;

export const emptyInteraction = (requestId: string, kind: string): InteractionData => ({
  requestId,
  kind,
  options: [],
  title: null,
  titleKey: null,
  icon: null,
  resolved: null,
  submitted: false,
  declined: false,
  activePage: 0,
  blocks: [],
  submitLabel: null,
  submitKey: null,
  dismiss: null,
  present: null,
  variant: null,
  mod: null,
  dismissedBy: null,
  values: {},
});

export const message = (id: number, role: Role, patch: Partial<ChatMessage> = {}): ChatMessage => ({
  id,
  role,
  text: "",
  toolName: null,
  toolMcp: false,
  toolUseId: null,
  interaction: null,
  path: null,
  diffLines: null,
  files: null,
  query: null,
  statements: null,
  compact: null,
  agentRun: null,
  agentResult: null,
  thinkingTokens: null,
  toolMs: null,
  sourceIndex: -1,
  labelOnly: false,
  result: null,
  ephemeral: false,
  attachments: null,
  images: null,
  timestamp: Date.now(),
  children: [],
  sendStatus: "sent",
  usage: null,
  uuid: null,
  ...patch,
});
