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
  | "notification";

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

export interface InteractionOption {
  id: string;
  label: string | null;
  description: string | null;
  preview: string | null;
}


export const VALUE_SEPARATOR = "\u001F";

export interface ComponentOption {
  value: string;
  label: string;
  description: string | null;
  preview: string | null;
  style: string | null;
  icon: string | null;
  labelKey: string | null;
}

export interface ComponentElement {
  type: "text" | "select" | "input" | "toggle" | "buttons" | "preview" | "page" | "notes" | "bar";
  id: string | null;
  label: string | null;
  text: string | null;
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

export const componentAnswerable = (blocks: ComponentElement[]): boolean =>
  blocks.some((element) =>
    element.type === "page" ? componentAnswerable(element.blocks) : element.type === "buttons" || !!element.id,
  );

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
