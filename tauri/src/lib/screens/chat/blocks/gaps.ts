import type { Role } from "$lib/data/chatModels";
import { snappedToken } from "$lib/ui/pixelGrid";

const BIG = () => snappedToken("--chat-gap-lg", 16);
const SMALL = () => snappedToken("--chat-gap-sm", 6);

const NOTICE: Role[] = ["api_error", "interrupted"];

const GROUPED: Role[] = [
  "thinking",
  "working",
  "tool",
  "tool_result",
  "interaction",
  "file_change",
  "compact",
  "plan",
  "agent",
  "notification",
];

const isNotice = (role: Role | null): boolean => role !== null && NOTICE.includes(role);

const group = (role: Role | null): number => {
  if (role !== null && GROUPED.includes(role)) return 0;
  if (role === "assistant") return 1;
  if (role === "user" || role === "api_error" || role === "interrupted") return 2;
  return 3;
};

export const gapAbove = (prev: Role | null, current: Role): number => {
  if (prev === null) return BIG();
  if (prev === "interaction" && current === "interaction") return SMALL();
  if (prev === current) return 0;
  if (isNotice(current) || isNotice(prev)) {
    const other = isNotice(current) ? prev : current;
    if (other === "assistant") return BIG();
    if (other === "user") return 0;
    return SMALL();
  }
  const a = group(prev);
  const b = group(current);
  if (a !== 0 && b !== 0) return BIG();
  if (current === "interaction") return SMALL();
  return a === 1 || b === 1 ? 0 : SMALL();
};

export const gapBelow = (current: Role, next: Role | null): number => {
  if (next !== null) return 0;
  if (isNotice(current) || current === "user") return 0;
  return BIG();
};
