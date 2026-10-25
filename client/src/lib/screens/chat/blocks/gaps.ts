import type { Role } from "$lib/data/chatModels";

export type GapRole = Role | "status";

const BIG = "var(--chat-gap-lg)";
const SMALL = "var(--chat-gap-sm)";
const TIGHT = "var(--chat-gap-xs)";
const NONE = "0px";

const NOTICE: GapRole[] = ["api_error", "info", "interrupted", "status", "usage"];

const GROUPED: GapRole[] = [
  "thinking",
  "working",
  "tool",
  "tool_result",
  "interaction",
  "file_change",
  "shared",
  "compact",
  "plan",
  "agent",
  "notification",
  "notice",
  "session_message",
  "plugin_message",
];

const ROW_ALIKE: Partial<Record<GapRole, GapRole>> = { notice: "tool" };

const isNotice = (role: GapRole | null): boolean => role !== null && NOTICE.includes(role);

const group = (role: GapRole | null): number => {
  if (role !== null && GROUPED.includes(role)) return 0;
  if (role === "assistant") return 1;
  if (role === "user" || role === "api_error" || role === "info" || role === "interrupted") return 2;
  return 3;
};

export const gapAbove = (before: GapRole | null, role: GapRole): string => {
  const prev = before === null ? null : (ROW_ALIKE[before] ?? before);
  const current = ROW_ALIKE[role] ?? role;
  if (prev === null) return BIG;
  if (prev === "interaction" && current === "interaction") return SMALL;
  if (prev === current) return NONE;
  if (isNotice(current) || isNotice(prev)) {
    const other = isNotice(current) ? prev : current;
    if (other === "assistant") return BIG;
    if (other === "user") return NONE;
    return SMALL;
  }
  const a = group(prev);
  const b = group(current);
  if (a !== 0 && b !== 0) return BIG;
  if (current === "interaction") return SMALL;
  return a === 1 || b === 1 ? NONE : SMALL;
};

export const gapBelow = (next: GapRole | null): string => (next === null ? BIG : NONE);

const CARDS: GapRole[] = [...GROUPED, ...NOTICE, "summary", "agent_report"];

const isCard = (role: GapRole | null): boolean => role !== null && CARDS.includes(role);

const isBlock = (role: GapRole): boolean => isCard(role) && !isNotice(role);

export const rowGap = (before: GapRole | null, role: GapRole, gap: string, carded = false): string => {
  if (before === null) return gap;
  if (before === "user" && role === "user") return NONE;
  if (isBlock(before) && isBlock(role)) return TIGHT;
  const continued = gap === NONE && !carded && !isCard(before) && !isCard(role);
  return continued ? NONE : SMALL;
};

export const NO_GAP = NONE;
