import { agentRunOf, toDismiss, toElement } from "$lib/services/chatSocket";
import { agentStopText } from "./agentModels";
import {
  diffKindOf,
  emptyInteraction,
  notebookCellOf,
  queryOf,
  sharedFilesFrom,
  statementsOf,
  VALUE_SEPARATOR,
  type ChatMessage,
  type InteractionData,
  type Role,
} from "./chatModels";
import { list, number, text, type Wire } from "./wire";

type MessageFields =
  | "role"
  | "text"
  | "path"
  | "interaction"
  | "diffLines"
  | "notebookCell"
  | "files"
  | "query"
  | "statements"
  | "compact"
  | "agentRun"
  | "agentResult"
  | "thinkingTokens"
  | "toolMs"
  | "toolFailed"
  | "labelOnly"
  | "result"
  | "images"
  | "timestamp"
  | "toolUseId"
  | "uuid";

export interface SessionMessage extends Pick<ChatMessage, MessageFields> {
  type: string | null;
  name: string | null;
  mcp: boolean;
  index: number;
  parent: string | null;
}

const ROLES: Record<string, Role> = {
  thinking: "thinking",
  working: "working",
  notification: "notification",
  notice: "notice",
  session_message: "session_message",
  plugin_message: "plugin_message",
  agent_report: "agent_report",
  tool_use: "tool",
  tool_result: "tool_result",
  file_change: "file_change",
  shared: "shared",
  interaction: "interaction",
  compact: "compact",
  summary: "summary",
  agent: "agent",
  plan: "plan",
  api_error: "api_error",
  stop: "api_error",
  interrupted: "interrupted",
};

const RESULT_FIELD: Record<string, string> = { notice: "level", api_error: "severity", stop: "severity" };

const roleOf = (raw: Wire): Role => {
  const type = text(raw, "type");
  if (type === "text") return text(raw, "role") === "assistant" ? "assistant" : "user";
  return (type !== null ? ROLES[type] : undefined) ?? "system";
};

const parseInteraction = (raw: Wire): InteractionData => {
  const kind = text(raw, "kind") ?? "permission";
  if (kind === "component") {
    const raw_values = (raw.values ?? {}) as Record<string, unknown>;
    const values: Record<string, string> = {};
    for (const [key, value] of Object.entries(raw_values)) {
      values[key] = Array.isArray(value) ? value.map(String).join(VALUE_SEPARATOR) : String(value);
    }
    const shown = raw.shown === true;
    return {
      ...emptyInteraction(shown ? "shown" : "resumed", kind),
      title: text(raw, "title"),
      titleKey: text(raw, "title_key"),
      icon: text(raw, "icon"),
      submitLabel: text(raw, "submit"),
      submitKey: text(raw, "submit_key"),
      dismiss: toDismiss(raw.dismiss),
      present: null,
      dismissedBy: text(raw, "dismissed_by"),
      blocks: list(raw, "blocks").flatMap(toElement),
      values,
      submitted: !shown,
      declined: raw.declined === true,
    };
  }
  const resolved = text(raw, "resolved") ?? "allow";
  return {
    ...emptyInteraction("resumed", kind),
    resolved,
    options: [{ id: resolved, label: null, description: null, preview: null }],
  };
};

export const parseSessionMessage = (raw: Wire): SessionMessage => {
  const type = text(raw, "type");
  const body =
    type === "file_change" || type === "compact" || type === "shared"
      ? ""
      : type === "interaction"
        ? (text(raw, "input") ?? "")
        : type === "agent"
          ? (text(raw, "description") ?? "")
          : type === "stop"
            ? agentStopText(text(raw, "reason"))
            : (text(raw, "text") ?? "");

  const images = list(raw, "images")
    .map((image) => {
      const uuid = text(image, "uuid");
      const index = number(image, "index");
      return uuid !== null && index !== null ? `${uuid}/${index}` : null;
    })
    .filter((image): image is string => image !== null);

  return {
    type,
    role: roleOf(raw),
    text: body,
    name: text(raw, "name") ?? text(raw, "tool_name") ?? text(raw, "subagent_type"),
    mcp: raw.mcp === true,
    path: text(raw, "path"),
    interaction: type === "interaction" ? parseInteraction(raw) : null,
    diffLines:
      type === "file_change"
        ? list(raw, "diff_lines").map((line) => ({
            kind: diffKindOf(text(line, "kind")),
            text: text(line, "text") ?? "",
          }))
        : null,
    notebookCell: type === "file_change" ? notebookCellOf(raw) : null,
    files: type === "shared" ? sharedFilesFrom(raw.files) : null,
    query: queryOf(raw),
    statements: statementsOf(raw),
    compact:
      type === "compact"
        ? {
            trigger: text(raw, "trigger"),
            preTokens: number(raw, "pre_tokens"),
            postTokens: number(raw, "post_tokens"),
            summary: text(raw, "summary") ?? "",
          }
        : null,
    thinkingTokens: type === "thinking" ? number(raw, "tokens") : null,
    toolMs: number(raw, "ms"),
    toolFailed: raw.is_error === true,
    agentRun: type === "agent" ? agentRunOf(raw) : null,
    agentResult: (() => {
      const done = raw.agent_result;
      if (type !== "agent" || typeof done !== "object" || done === null) return null;
      const fields = done as Wire;
      return {
        status: text(fields, "status"),
        durationMs: number(fields, "duration_ms"),
        tokens: number(fields, "tokens"),
        toolUses: number(fields, "tool_uses"),
      };
    })(),
    index: number(raw, "index") ?? -1,
    labelOnly: raw.label === true,
    result: text(raw, RESULT_FIELD[type ?? ""] ?? "result"),
    images: images.length ? images : null,
    timestamp: number(raw, "ts"),
    parent: text(raw, "parent"),
    toolUseId: text(raw, "id"),
    uuid: text(raw, "uuid"),
  };
};

const VISIBLE_ROLES: Role[] = ["tool", "file_change", "working", "interrupted"];

export const isVisible = (item: SessionMessage): boolean =>
  !!item.text.trim() ||
  item.interaction !== null ||
  !!item.files?.length ||
  item.compact !== null ||
  item.labelOnly ||
  !!item.images?.length ||
  VISIBLE_ROLES.includes(item.role);
