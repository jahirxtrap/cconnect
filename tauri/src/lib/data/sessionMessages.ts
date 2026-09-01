import { toDismiss, toElement } from "$lib/services/chatSocket";
import {
  diffKindOf,
  emptyInteraction,
  VALUE_SEPARATOR,
  type AgentResult,
  type CompactData,
  type DiffLine,
  type InteractionData,
  type Role,
} from "./chatModels";

export interface SessionMessage {
  type: string | null;
  role: Role;
  text: string;
  name: string | null;
  path: string | null;
  interaction: InteractionData | null;
  diffLines: DiffLine[] | null;
  compact: CompactData | null;
  agentResult: AgentResult | null;
  thinkingTokens: number | null;
  index: number;
  labelOnly: boolean;
  result: string | null;
  images: string[] | null;
  timestamp: number | null;
  parent: string | null;
  toolUseId: string | null;
}

type Wire = Record<string, unknown>;

const text = (raw: Wire, key: string): string | null => (typeof raw[key] === "string" ? (raw[key] as string) : null);
const int = (raw: Wire, key: string): number | null => (typeof raw[key] === "number" ? (raw[key] as number) : null);
const list = (raw: Wire, key: string): Wire[] => (Array.isArray(raw[key]) ? (raw[key] as Wire[]) : []);

const ROLES: Record<string, Role> = {
  thinking: "thinking",
  working: "working",
  notification: "notification",
  session_message: "session_message",
  tool_use: "tool",
  tool_result: "tool_result",
  file_change: "file_change",
  interaction: "interaction",
  compact: "compact",
  summary: "summary",
  agent: "agent",
  plan: "plan",
  api_error: "api_error",
  interrupted: "interrupted",
};

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
    type === "file_change" || type === "compact"
      ? ""
      : type === "interaction"
        ? (text(raw, "input") ?? "")
        : type === "agent"
          ? (text(raw, "description") ?? "")
          : (text(raw, "text") ?? "");

  const images = list(raw, "images")
    .map((image) => {
      const uuid = text(image, "uuid");
      const index = int(image, "index");
      return uuid !== null && index !== null ? `${uuid}/${index}` : null;
    })
    .filter((image): image is string => image !== null);

  return {
    type,
    role: roleOf(raw),
    text: body,
    name: text(raw, "name") ?? text(raw, "tool_name") ?? text(raw, "subagent_type"),
    path: text(raw, "path"),
    interaction: type === "interaction" ? parseInteraction(raw) : null,
    diffLines:
      type === "file_change"
        ? list(raw, "diff_lines").map((line) => ({
            kind: diffKindOf(text(line, "kind")),
            text: text(line, "text") ?? "",
          }))
        : null,
    compact:
      type === "compact"
        ? {
            trigger: text(raw, "trigger"),
            preTokens: int(raw, "pre_tokens"),
            postTokens: int(raw, "post_tokens"),
            summary: text(raw, "summary") ?? "",
          }
        : null,
    thinkingTokens: type === "thinking" ? int(raw, "tokens") : null,
    agentResult: (() => {
      const done = raw.agent_result;
      if (type !== "agent" || typeof done !== "object" || done === null) return null;
      const fields = done as Wire;
      return {
        status: text(fields, "status"),
        durationMs: int(fields, "duration_ms"),
        tokens: int(fields, "tokens"),
        toolUses: int(fields, "tool_uses"),
      };
    })(),
    index: int(raw, "index") ?? -1,
    labelOnly: raw.label === true,
    result: text(raw, "result"),
    images: images.length ? images : null,
    timestamp: int(raw, "ts"),
    parent: text(raw, "parent"),
    toolUseId: text(raw, "id"),
  };
};

const VISIBLE_ROLES: Role[] = ["tool", "working", "interrupted"];

export const isVisible = (item: SessionMessage): boolean =>
  !!item.text.trim() ||
  item.interaction !== null ||
  !!item.diffLines?.length ||
  item.compact !== null ||
  item.labelOnly ||
  !!item.images?.length ||
  VISIBLE_ROLES.includes(item.role);
