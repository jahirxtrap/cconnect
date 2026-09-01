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
  | "compact"
  | "system"
  | "api_error"
  | "interrupted"
  | "plan"
  | "agent"
  | "notification"
  | "session_message";

export type SendStatus = "sent" | "error";

export type ConnectionState = "connecting" | "connected" | "disconnected";

export type DiffKind = "header" | "hunk" | "add" | "del" | "ctx";

export interface DiffLine {
  kind: DiffKind;
  text: string;
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

export interface InteractionData {
  requestId: string;
  kind: string;
  options: InteractionOption[];
  title: string | null;
  titleKey: string | null;
  icon: string | null;
  resolved: string | null;
  submitted: boolean;
  declined: boolean;
  activePage: number;
  blocks: ComponentElement[];
  submitLabel: string | null;
  submitKey: string | null;
  dismiss: ComponentOption | null;
  present: string | null;
  dismissedBy: string | null;
  values: Record<string, string>;
}

export interface ChatMessage {
  id: number;
  role: Role;
  text: string;
  toolName: string | null;
  toolUseId: string | null;
  interaction: InteractionData | null;
  path: string | null;
  diffLines: DiffLine[] | null;
  compact: CompactData | null;
  agentResult: AgentResult | null;
  thinkingTokens: number | null;
  sourceIndex: number;
  labelOnly: boolean;
  result: string | null;
  ephemeral: boolean;
  attachments: string[] | null;
  images: string[] | null;
  timestamp: number | null;
  children: ChatMessage[];
  sendStatus: SendStatus;
}

export interface TodoItem {
  id: string | null;
  content: string;
  status: string;
  activeForm: string;
}

export interface QueuedMessage {
  id: string;
  text: string;
  attachments: string[];
  uploading: boolean;
}

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
  dismissedBy: null,
  values: {},
});

export const message = (id: number, role: Role, patch: Partial<ChatMessage> = {}): ChatMessage => ({
  id,
  role,
  text: "",
  toolName: null,
  toolUseId: null,
  interaction: null,
  path: null,
  diffLines: null,
  compact: null,
  agentResult: null,
  thinkingTokens: null,
  sourceIndex: -1,
  labelOnly: false,
  result: null,
  ephemeral: false,
  attachments: null,
  images: null,
  timestamp: Date.now(),
  children: [],
  sendStatus: "sent",
  ...patch,
});
