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

export interface InteractionQuestion {
  header: string | null;
  question: string | null;
  multiSelect: boolean;
  options: InteractionOption[];
}

export interface QuestionDraft {
  selected: string[];
  freeText: string;
  notes: string;
}

export const VALUE_SEPARATOR = "\u001F";

export interface ComponentOption {
  value: string;
  label: string;
  description: string | null;
  preview: string | null;
  style: string | null;
}

export interface ComponentElement {
  type: "text" | "select" | "input" | "toggle" | "buttons" | "preview";
  id: string | null;
  label: string | null;
  text: string | null;
  placeholder: string | null;
  value: string | null;
  checked: boolean;
  multiline: boolean;
  multiple: boolean;
  required: boolean;
  options: ComponentOption[];
  block: string | null;
}

export interface InteractionData {
  requestId: string;
  kind: string;
  options: InteractionOption[];
  title: string | null;
  resolved: string | null;
  questions: InteractionQuestion[];
  drafts: QuestionDraft[];
  submitted: boolean;
  declined: boolean;
  summary: string[];
  notes: string[];
  activeQuestion: number;
  blocks: ComponentElement[];
  submitLabel: string | null;
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

export const isPending = (data: InteractionData): boolean =>
  data.kind === "questions" || data.kind === "component"
    ? !(data.submitted || data.declined)
    : data.resolved === null;

export const emptyInteraction = (requestId: string, kind: string): InteractionData => ({
  requestId,
  kind,
  options: [],
  title: null,
  resolved: null,
  questions: [],
  drafts: [],
  submitted: false,
  declined: false,
  summary: [],
  notes: [],
  activeQuestion: 0,
  blocks: [],
  submitLabel: null,
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
